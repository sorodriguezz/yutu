export type AuthProfile = {
  id: string;
  name: string;
  email: string;
  picture?: string;
};

export type RemotePlaylist = {
  id: string;
  title: string;
  itemCount: number;
};

export interface AuthPort {
  /** Launches the Google consent flow (system browser + loopback) and stores tokens. */
  signIn(): Promise<AuthProfile>;
  /** Clears stored tokens/profile. */
  signOut(): Promise<void>;
  /** Returns the cached profile, or null if not signed in. */
  getProfile(): Promise<AuthProfile | null>;
  /** Lists the signed-in user's YouTube playlists (requires youtube scope). */
  listYouTubePlaylists(): Promise<RemotePlaylist[]>;
  /** Returns the videoIds of a given YouTube playlist (with titles). */
  getYouTubePlaylistItems(
    playlistId: string
  ): Promise<{ videoId: string; title: string; author?: string; thumbnail?: string }[]>;
}
