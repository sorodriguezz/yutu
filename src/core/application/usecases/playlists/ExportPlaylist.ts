import { PlaylistRepository } from "../../ports/PlaylistRepository";
import { ArchivePort } from "../../ports/ArchivePort";

export class ExportPlaylist {
  constructor(
    private readonly repo: PlaylistRepository,
    private readonly archive: ArchivePort
  ) {}

  async execute(playlistId: string) {
    const playlists = await this.repo.getAll();
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    await this.archive.exportPlaylist(pl);
  }
}
