export type Track = {
  id: string; // uuid
  provider: "youtube";
  videoId: string; // 11 chars
  title?: string;
  addedAt: number;
};
