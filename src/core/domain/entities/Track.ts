export type TrackProvider = "youtube" | "local";

export type MediaType = "audio" | "video";

export type Track = {
  id: string; // uuid
  provider: TrackProvider;

  // YouTube source
  videoId?: string; // 11 chars (provider === "youtube")

  // Local source
  filePath?: string; // absolute path on disk (provider === "local")
  mediaType?: MediaType; // audio | video (provider === "local")

  // Common metadata
  title?: string;
  author?: string;
  thumbnail?: string; // URL / data-uri to artwork
  duration?: number; // seconds
  addedAt: number;
};
