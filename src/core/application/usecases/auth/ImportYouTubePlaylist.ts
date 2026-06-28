import { Playlist } from "../../../domain/entities/Playlist";
import { Track } from "../../../domain/entities/Track";
import { AuthPort } from "../../ports/AuthPort";
import { PlaylistRepository } from "../../ports/PlaylistRepository";

/**
 * Pulls a YouTube playlist's items into a new local playlist.
 */
export class ImportYouTubePlaylist {
  constructor(
    private readonly auth: AuthPort,
    private readonly repo: PlaylistRepository,
    private readonly makeId: () => string
  ) {}

  async execute(playlistId: string, name: string): Promise<Playlist[]> {
    const items = await this.auth.getYouTubePlaylistItems(playlistId);
    const now = Date.now();

    const tracks: Track[] = items.map((it) => ({
      id: this.makeId(),
      provider: "youtube",
      videoId: it.videoId,
      title: it.title,
      author: it.author,
      thumbnail: it.thumbnail,
      addedAt: now,
    }));

    const playlists = await this.repo.getAll();
    const newPlaylist: Playlist = {
      id: this.makeId(),
      name: name || "YouTube",
      createdAt: now,
      updatedAt: now,
      items: tracks,
    };

    const updated = [...playlists, newPlaylist];
    await this.repo.saveAll(updated);
    return updated;
  }
}
