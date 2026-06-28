import { AuthProfile } from "./AuthPort";

export type AuthState = {
  profile: AuthProfile;
  accessToken: string;
  refreshToken?: string;
  expiry: number; // epoch ms
  scope?: string;
};

export type Settings = {
  accentColor: string; // CSS hex
  volumeDefault: number; // 0..100
  youtubeApiKey?: string; // YouTube Data API v3 key (optional)

  // Google OAuth (Desktop app client)
  googleClientId?: string;
  googleClientSecret?: string;

  // Signed-in session (tokens + profile)
  auth?: AuthState;
};

export interface SettingsRepository {
  get(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}
