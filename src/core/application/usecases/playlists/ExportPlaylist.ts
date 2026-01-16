import { PlaylistRepository } from "../../ports/PlaylistRepository";
import { FileDialogPort } from "../../ports/FileDialogPort";

export class ExportPlaylist {
  constructor(
    private readonly repo: PlaylistRepository,
    private readonly file: FileDialogPort
  ) {}

  async execute(playlistId: string) {
    const playlists = await this.repo.getAll();
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl) return;

    const path = await this.file.pickExportPath(`${pl.name}.json`);
    if (!path) return;

    await this.file.writeTextFile(path, JSON.stringify(pl, null, 2));
  }
}
