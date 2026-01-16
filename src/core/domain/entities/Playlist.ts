import { Track } from "./Track";

export type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  items: Track[];
};
