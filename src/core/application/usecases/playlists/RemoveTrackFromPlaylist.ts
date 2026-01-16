import { PlaylistRepository } from "../../ports/PlaylistRepository";

export class RemoveTrackFromPlaylist {
  constructor(private readonly repo: PlaylistRepository) {}

  async execute(playlistId: string, trackId: string) {
    const playlists = await this.repo.getAll();
    const idx = playlists.findIndex((p) => p.id === playlistId);
    if (idx === -1) return playlists;

    const now = Date.now();
    const pl = playlists[idx];
    const updatedPl = {
      ...pl,
      items: pl.items.filter((i) => i.id !== trackId),
      updatedAt: now,
    };

    const updated = [...playlists];
    updated[idx] = updatedPl;
    await this.repo.saveAll(updated);
    return updated;
  }
}
