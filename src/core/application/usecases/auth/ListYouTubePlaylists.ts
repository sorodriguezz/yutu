import { AuthPort, RemotePlaylist } from "../../ports/AuthPort";

export class ListYouTubePlaylists {
  constructor(private readonly auth: AuthPort) {}

  async execute(): Promise<RemotePlaylist[]> {
    return this.auth.listYouTubePlaylists();
  }
}
