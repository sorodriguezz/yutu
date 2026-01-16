import { PlaylistRepository } from "../../ports/PlaylistRepository";
import { QueueService } from "../../services/QueueService";

export class EnqueuePlaylist {
  constructor(
    private readonly repo: PlaylistRepository,
    private readonly queue: QueueService
  ) {}

  async execute(playlistId: string, startIndex: number = 0) {
    const playlists = await this.repo.getAll();
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl) return this.queue.getState();

    // Replace queue with playlist tracks (like YouTube Music)
    this.queue.replaceQueue(pl.items, startIndex);
    return this.queue.getState();
  }
}
