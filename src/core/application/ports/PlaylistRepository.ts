import { Playlist } from "../../domain/entities/Playlist";

export interface PlaylistRepository {
  getAll(): Promise<Playlist[]>;
  saveAll(playlists: Playlist[]): Promise<void>;
}
