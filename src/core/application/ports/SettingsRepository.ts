export type Settings = {
  accentColor: string; // CSS hex
  volumeDefault: number; // 0..100
  youtubeApiKey?: string; // YouTube Data API v3 key (optional)
};

export interface SettingsRepository {
  get(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}
