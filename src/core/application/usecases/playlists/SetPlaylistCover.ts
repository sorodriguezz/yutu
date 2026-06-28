import { Playlist } from "../../../domain/entities/Playlist";
import { PlaylistRepository } from "../../ports/PlaylistRepository";

export class SetPlaylistCover {
  constructor(private readonly repo: PlaylistRepository) {}

  async execute(playlistId: string, cover: string): Promise<Playlist[]> {
    const playlists = await this.repo.getAll();
    const idx = playlists.findIndex((p) => p.id === playlistId);
    if (idx === -1) return playlists;

    const updated = [...playlists];
    updated[idx] = {
      ...playlists[idx],
      cover: cover || undefined, // string vacío => vuelve a la nota por defecto
      updatedAt: Date.now(),
    };
    await this.repo.saveAll(updated);
    return updated;
  }
}
