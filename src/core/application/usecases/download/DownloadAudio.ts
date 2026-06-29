import { DownloaderPort, DownloadProgress } from "../../ports/DownloaderPort";

export class DownloadAudio {
  constructor(private readonly downloader: DownloaderPort) {}

  async execute(opts: {
    videoId: string;
    title?: string;
    outDir: string;
    onProgress?: (p: DownloadProgress) => void;
  }) {
    if (!opts.videoId) throw new Error("videoId requerido");
    return this.downloader.downloadAudio(opts);
  }
}
