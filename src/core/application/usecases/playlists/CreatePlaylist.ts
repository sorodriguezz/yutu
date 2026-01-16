import { Playlist } from "../../../domain/entities/Playlist";
import { PlaylistRepository } from "../../ports/PlaylistRepository";

export class CreatePlaylist {
  constructor(
    private readonly repo: PlaylistRepository,
    private readonly makeId: () => string
  ) {}

  async execute(nameRaw: string): Promise<Playlist[]> {
    const name = String(nameRaw ?? "").trim();
    if (!name) return this.repo.getAll();

    const playlists = await this.repo.getAll();
    const now = Date.now();

    const playlist: Playlist = {
      id: this.makeId(),
      name,
      createdAt: now,
      updatedAt: now,
      items: [],
    };

    const updated = [...playlists, playlist];
    await this.repo.saveAll(updated);
    return updated;
  }
}
