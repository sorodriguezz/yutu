import { PlaylistRepository } from "../../ports/PlaylistRepository";
import { Track, TrackProvider, MediaType } from "../../../domain/entities/Track";

export type AddTrackInput = {
  provider?: TrackProvider;
  videoId?: string;
  filePath?: string;
  mediaType?: MediaType;
  title?: string;
  author?: string;
  thumbnail?: string;
  duration?: number;
};

export class AddTrackToPlaylist {
  constructor(
    private readonly repo: PlaylistRepository,
    private readonly makeId: () => string
  ) {}

  async execute(playlistId: string, input: AddTrackInput) {
    const playlists = await this.repo.getAll();

    const idx = playlists.findIndex((p) => p.id === playlistId);
    if (idx === -1) return playlists;

    // No duplicar: si la pista ya está en la playlist, no la agregues de nuevo
    const dup = playlists[idx].items.some(
      (t) =>
        (!!input.videoId && t.videoId === input.videoId) ||
        (!!input.filePath && t.filePath === input.filePath)
    );
    if (dup) return playlists;

    const now = Date.now();
    const provider: TrackProvider =
      input.provider || (input.filePath ? "local" : "youtube");

    const track: Track = {
      id: this.makeId(),
      provider,
      videoId: input.videoId || undefined,
      filePath: input.filePath,
      mediaType: input.mediaType,
      title: input.title,
      author: input.author,
      thumbnail: input.thumbnail,
      duration: input.duration,
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
