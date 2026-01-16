import { PlaylistRepository } from "../../ports/PlaylistRepository";
import { Track } from "../../../domain/entities/Track";

export class AddTrackToPlaylist {
  constructor(
    private readonly repo: PlaylistRepository,
    private readonly makeId: () => string
  ) {}

  async execute(
    playlistId: string,
    input: { videoId: string; title?: string }
  ) {
    const playlists = await this.repo.getAll();
    
    const idx = playlists.findIndex((p) => p.id === playlistId);
    if (idx === -1) return playlists;

    const now = Date.now();
    const track: Track = {
      id: this.makeId(),
      provider: "youtube",
      videoId: input.videoId,
      title: input.title,
      addedAt: now,
    };

    const pl = playlists[idx];
    const updatedPl = { ...pl, items: [...pl.items, track], updatedAt: now };
    const updated = [...playlists];
    updated[idx] = updatedPl;

    await this.repo.saveAll(updated);
    return updated;
  }
}
