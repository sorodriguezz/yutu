import { PlaylistRepository } from "../../ports/PlaylistRepository";

export class DeletePlaylist {
  constructor(private readonly repo: PlaylistRepository) {}

  async execute(playlistId: string) {
    const playlists = await this.repo.getAll();
    const updated = playlists.filter((p) => p.id !== playlistId);
    await this.repo.saveAll(updated);
    return updated;
  }
}
