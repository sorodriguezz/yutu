import { Playlist } from "../../domain/entities/Playlist";

export interface ArchivePort {
  /**
   * Exports a playlist. If it contains local files, bundles them into a .zip
   * (with a media/ folder) and rewrites the local paths to be relative to the
   * archive. Otherwise exports a plain .json. Returns false if cancelled.
   */
  exportPlaylist(playlist: Playlist): Promise<boolean>;

  /**
   * Imports a playlist from a .zip bundle (extracting media and rewriting local
   * paths to absolute) or a plain .json. Returns null if cancelled.
   */
  importPlaylist(): Promise<Playlist | null>;
}
