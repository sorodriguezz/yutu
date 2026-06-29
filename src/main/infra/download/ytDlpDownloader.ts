import { app, net } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DownloaderPort, DownloadProgress, DownloadResult } from "../../../core/application/ports/DownloaderPort";

// ffmpeg-static exporta la ruta al binario de ffmpeg para la plataforma actual.
// En producción (asar) hay que apuntar a la copia desempaquetada.
function resolveFfmpeg(): string | null {
  let p: string | null = null;
  try { p = require("ffmpeg-static") as string; } catch { p = null; }
  if (!p) return null;
  return p.replace("app.asar", "app.asar.unpacked");
}

function ytDlpAssetName(): string {
  if (process.platform === "win32") return "yt-dlp.exe";
  if (process.platform === "darwin") return "yt-dlp_macos";
  return "yt-dlp";
}

/**
 * Descarga audio de YouTube a MP3 usando el binario yt-dlp (auto-descargado a
 * userData en el primer uso) y ffmpeg (ffmpeg-static) para la conversión.
 */
export class YtDlpDownloader implements DownloaderPort {
  private binPath: string | null = null;

  private get binDir() {
    return path.join(app.getPath("userData"), "bin");
  }

  // Asegura que el binario de yt-dlp existe localmente; lo descarga si falta.
  private async ensureBinary(): Promise<string> {
    if (this.binPath && fs.existsSync(this.binPath)) return this.binPath;
    const dir = this.binDir;
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, ytDlpAssetName());
    if (fs.existsSync(target) && fs.statSync(target).size > 0) {
      this.binPath = target;
      return target;
    }
    const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytDlpAssetName()}`;
    await this.downloadFile(url, target);
    if (process.platform !== "win32") {
      try { fs.chmodSync(target, 0o755); } catch (e) {}
    }
    this.binPath = target;
    return target;
  }

  // Descarga un archivo siguiendo redirecciones (electron net).
  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = net.request(url);
      request.on("response", (response) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          const loc = Array.isArray(response.headers.location)
            ? response.headers.location[0]
            : (response.headers.location as string);
          this.downloadFile(loc, dest).then(resolve).catch(reject);
          return;
        }
        if (status !== 200) { reject(new Error(`Descarga falló (${status})`)); return; }
        const tmp = dest + ".part";
        const file = fs.createWriteStream(tmp);
        file.on("error", (err) => reject(err));
        response.on("data", (chunk) => file.write(chunk));
        response.on("end", () => {
          file.end(() => { try { fs.renameSync(tmp, dest); resolve(); } catch (e) { reject(e as Error); } });
        });
        response.on("error", (err: Error) => reject(err));
      });
      request.on("error", (err) => reject(err));
      request.end();
    });
  }

  async downloadAudio(opts: {
    videoId: string;
    title?: string;
    outDir: string;
    onProgress?: (p: DownloadProgress) => void;
  }): Promise<DownloadResult> {
    const { videoId, outDir, onProgress } = opts;
    const emit = (percent: number, stage: string) =>
      onProgress && onProgress({ videoId, percent, stage });

    emit(0, "preparing");
    fs.mkdirSync(outDir, { recursive: true });
    const bin = await this.ensureBinary();
    const ffmpeg = resolveFfmpeg();

    const AUDIO_EXT = /\.(mp3|m4a|webm|opus|ogg|aac|wav|flac)$/i;
    const args = [
      "--no-playlist", "--newline", "--no-warnings", "--no-mtime",
      "-o", path.join(outDir, "%(title)s [%(id)s].%(ext)s"),
    ];
    if (ffmpeg) {
      // Con ffmpeg: extrae a MP3 e incrusta carátula + metadatos en el archivo.
      args.push(
        "-x", "--audio-format", "mp3", "--audio-quality", "0",
        "--embed-thumbnail", "--embed-metadata",
        "--ffmpeg-location", path.dirname(ffmpeg)
      );
    } else {
      // Sin ffmpeg: descarga el audio nativo (m4a) sin convertir — igual es reproducible en Yutu.
      args.push("-f", "bestaudio[ext=m4a]/bestaudio");
    }
    args.push(`https://www.youtube.com/watch?v=${videoId}`);

    return new Promise<DownloadResult>((resolve, reject) => {
      const child = spawn(bin, args, { windowsHide: true });
      let finalPath = "";
      let stderr = "";
      let outBuf = "";

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const m = /\[download\]\s+([\d.]+)%/.exec(trimmed);
        if (m) { emit(parseFloat(m[1]), "downloading"); return; }
        if (/\[ExtractAudio\]/.test(trimmed)) emit(99, "converting");
        // "[download] Destination: X" y "[ExtractAudio] Destination: X.mp3" → la última gana.
        const dest = /Destination:\s+(.+)$/.exec(trimmed);
        if (dest && AUDIO_EXT.test(dest[1].trim())) finalPath = dest[1].trim();
        else if (AUDIO_EXT.test(trimmed) && path.isAbsolute(trimmed)) finalPath = trimmed;
      };

      // Acumula el buffer y procesa solo líneas completas (la ruta final puede
      // llegar fragmentada o sin newline al cierre).
      child.stdout.on("data", (d: Buffer) => {
        outBuf += String(d);
        const lines = outBuf.split(/\r?\n/);
        outBuf = lines.pop() || "";
        lines.forEach(handleLine);
      });
      child.stderr.on("data", (d: Buffer) => { stderr += String(d); });

      child.on("error", (err) => reject(err));
      child.on("close", (code) => {
        if (outBuf) handleLine(outBuf); // última línea sin newline
        if (code === 0) {
          if (!finalPath || !fs.existsSync(finalPath)) {
            // fallback: busca el archivo de audio más reciente en outDir
            try {
              const audios = fs.readdirSync(outDir)
                .filter((f) => AUDIO_EXT.test(f))
                .map((f) => path.join(outDir, f))
                .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
              if (audios[0]) finalPath = audios[0];
            } catch (e) {}
          }
          if (finalPath) { emit(100, "done"); resolve({ videoId, filePath: finalPath }); }
          else reject(new Error("No se encontró el archivo descargado"));
        } else {
          emit(0, "error");
          reject(new Error(stderr.split(/\r?\n/).filter(Boolean).pop() || `yt-dlp salió con código ${code}`));
        }
      });
    });
  }
}
