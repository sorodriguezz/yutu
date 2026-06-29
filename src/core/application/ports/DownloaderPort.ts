export type DownloadProgress = {
  videoId: string;
  percent: number; // 0..100
  stage: string; // "preparing" | "downloading" | "converting" | "done" | "error"
};

export type DownloadResult = {
  videoId: string;
  filePath: string;
};

export interface DownloaderPort {
  /** Descarga el audio de un video de YouTube y lo convierte a MP3. */
  downloadAudio(opts: {
    videoId: string;
    title?: string;
    outDir: string;
    onProgress?: (p: DownloadProgress) => void;
  }): Promise<DownloadResult>;
}
