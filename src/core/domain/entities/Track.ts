export type Track = {
  id: string; // uuid
  provider: "youtube";
  videoId: string; // 11 chars
  title?: string;
  author?: string;
  thumbnail?: string; // URL to video thumbnail
  duration?: number; // Duration in seconds
  addedAt: number;
};
