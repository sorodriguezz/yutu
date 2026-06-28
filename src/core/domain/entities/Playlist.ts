import { Track } from "./Track";

export type Playlist = {
  id: string;
  name: string;
  cover?: string; // data-URL de la imagen del icono (si no, se usa la nota por defecto)
  createdAt: number;
  updatedAt: number;
  items: Track[];
};
