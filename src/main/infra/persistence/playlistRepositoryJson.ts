import { PlaylistRepository } from "../../../core/application/ports/PlaylistRepository";
import { Playlist } from "../../../core/domain/entities/Playlist";
import { JsonDb } from "./jsonDb";

export class PlaylistRepositoryJson implements PlaylistRepository {
  constructor(private readonly db: JsonDb) {}

  async getAll(): Promise<Playlist[]> {
    return this.db.read().playlists;
  }

  async saveAll(playlists: Playlist[]): Promise<void> {
    const current = this.db.read();
    this.db.write({ ...current, playlists });
  }
}