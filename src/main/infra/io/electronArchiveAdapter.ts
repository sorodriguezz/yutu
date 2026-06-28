import { dialog, BrowserWindow, app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { ArchivePort } from "../../../core/application/ports/ArchivePort";
import { Playlist } from "../../../core/domain/entities/Playlist";
import { Track } from "../../../core/domain/entities/Track";

// adm-zip no trae tipos propios; lo cargamos sin tipado estricto.
const AdmZip: any = require("adm-zip");

function safeName(name: string): string {
  return (name || "playlist").replace(/[\\/:*?"<>|]+/g, "_").trim() || "playlist";
}

export class ElectronArchiveAdapter implements ArchivePort {
  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  async exportPlaylist(playlist: Playlist): Promise<boolean> {
    const win = this.getWindow();
    if (!win) return false;

    const hasLocal = playlist.items.some(
      (t) => t.provider === "local" && !!t.filePath
    );

    if (!hasLocal) {
      // Sin archivos locales → JSON simple
      const res = await dialog.showSaveDialog(win, {
        title: "Exportar playlist",
        defaultPath: `${safeName(playlist.name)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (res.canceled || !res.filePath) return false;
      fs.writeFileSync(res.filePath, JSON.stringify(playlist, null, 2), "utf-8");
      return true;
    }

    // Con archivos locales → ZIP (carpeta media/ + playlist.json con rutas relativas)
    const res = await dialog.showSaveDialog(win, {
      title: "Exportar playlist (incluye archivos locales)",
      defaultPath: `${safeName(playlist.name)}.zip`,
      filters: [{ name: "Zip", extensions: ["zip"] }],
    });
    if (res.canceled || !res.filePath) return false;

    const zip = new AdmZip();
    const usedNames = new Set<string>();

    const items: Track[] = playlist.items.map((t) => {
      if (t.provider !== "local" || !t.filePath || !fs.existsSync(t.filePath)) {
        return t;
      }
      const ext = path.extname(t.filePath);
      const base = path.basename(t.filePath, ext);
      let name = `${base}${ext}`;
      let i = 1;
      while (usedNames.has(name)) {
        name = `${base} (${i})${ext}`;
        i++;
      }
      usedNames.add(name);
      zip.addLocalFile(t.filePath, "media", name);
      // La ruta apunta a donde quedará el archivo al descomprimir el zip
      return { ...t, filePath: `media/${name}` };
    });

    const bundle: Playlist = { ...playlist, items };
    zip.addFile(
      "playlist.json",
      Buffer.from(JSON.stringify(bundle, null, 2), "utf-8")
    );
    zip.writeZip(res.filePath);
    return true;
  }

  async importPlaylist(): Promise<Playlist | null> {
    const win = this.getWindow();
    if (!win) return null;

    const res = await dialog.showOpenDialog(win, {
      title: "Importar playlist",
      properties: ["openFile"],
      filters: [{ name: "Playlist (.zip / .json)", extensions: ["zip", "json"] }],
    });
    if (res.canceled || res.filePaths.length === 0) return null;

    const filePath = res.filePaths[0];
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".json") {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Playlist;
      return this.isPlaylist(parsed) ? parsed : null;
    }

    // .zip → extraer media/ y reescribir rutas locales a absolutas
    const zip = new AdmZip(filePath);
    const entry = zip.getEntry("playlist.json");
    if (!entry) return null;
    const parsed = JSON.parse(zip.readAsText(entry)) as Playlist;
    if (!this.isPlaylist(parsed)) return null;

    const extractDir = path.join(
      app.getPath("userData"),
      "imported",
      `${safeName(parsed.name)}-${Date.now()}`
    );
    fs.mkdirSync(extractDir, { recursive: true });
    zip.extractAllTo(extractDir, true);

    const items: Track[] = parsed.items.map((t) => {
      if (t.provider === "local" && t.filePath) {
        return { ...t, filePath: path.join(extractDir, t.filePath) };
      }
      return t;
    });

    return { ...parsed, items };
  }

  private isPlaylist(p: any): p is Playlist {
    return !!p && typeof p.name === "string" && Array.isArray(p.items);
  }
}
