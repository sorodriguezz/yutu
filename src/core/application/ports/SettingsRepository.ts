export type Settings = {
  accentColor: string; // CSS hex
  volumeDefault: number; // 0..100
};

export interface SettingsRepository {
  get(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}
