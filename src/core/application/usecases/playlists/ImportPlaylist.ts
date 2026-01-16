import { Playlist } from "../../../domain/entities/Playlist";
import { PlaylistRepository } from "../../ports/PlaylistRepository";
import { FileDialogPort } from "../../ports/FileDialogPort";

export class ImportPlaylist {
  constructor(
    private readonly repo: PlaylistRepository,
    private readonly file: FileDialogPort,
    private readonly makeId: () => string
  ) {}

  async execute(): Promise<Playlist[]> {
    const filePath = await this.file.pickImportFile();
    if (!filePath) return this.repo.getAll();

    const raw = await this.file.readTextFile(filePath);
    const parsed = JSON.parse(raw) as Playlist;

    if (!parsed?.name || !Array.isArray(parsed?.items)) {
      return this.repo.getAll();
    }

    const playlists = await this.repo.getAll();
    const now = Date.now();

    const newPlaylist: Playlist = {
      ...parsed,
      id: playlists.some((p) => p.id === parsed.id) ? this.makeId() : parsed.id,
      updatedAt: now,
    };

    const updated = [...playlists, newPlaylist];
    await this.repo.saveAll(updated);
    return updated;
  }
}
