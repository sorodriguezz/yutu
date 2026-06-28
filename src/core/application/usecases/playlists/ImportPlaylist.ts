import { Playlist } from "../../../domain/entities/Playlist";
import { PlaylistRepository } from "../../ports/PlaylistRepository";
import { ArchivePort } from "../../ports/ArchivePort";

export class ImportPlaylist {
  constructor(
    private readonly repo: PlaylistRepository,
    private readonly archive: ArchivePort,
    private readonly makeId: () => string
  ) {}

  async execute(): Promise<Playlist[]> {
    const imported = await this.archive.importPlaylist();
    if (!imported) return this.repo.getAll();

    const playlists = await this.repo.getAll();
    const now = Date.now();

    const newPlaylist: Playlist = {
      ...imported,
      id: playlists.some((p) => p.id === imported.id) ? this.makeId() : imported.id,
      updatedAt: now,
    };

    const updated = [...playlists, newPlaylist];
    await this.repo.saveAll(updated);
    return updated;
  }
}
