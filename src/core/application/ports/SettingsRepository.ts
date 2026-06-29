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
  accentSecondary?: string; // CSS hex — neón secundario de la paleta (opcional)
  palette?: string; // id de la paleta synthwave elegida ("custom" si es color libre)
  language?: string; // "es" | "en"
  crossfadeSec?: number; // 0..12 — fundido entre canciones (0 = corte seco)
  blockAds?: boolean; // bloquear anuncios en el modo YouTube Music
  downloadDir?: string; // carpeta destino de las descargas MP3
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
