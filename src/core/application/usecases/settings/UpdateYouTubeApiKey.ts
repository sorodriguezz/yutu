import { SettingsRepository } from "../../ports/SettingsRepository";

export class UpdateYouTubeApiKey {
  constructor(private readonly settings: SettingsRepository) {}

  async execute(apiKey: string) {
    const current = await this.settings.get();
    await this.settings.save({
      ...current,
      youtubeApiKey: apiKey,
    });
  }
}
