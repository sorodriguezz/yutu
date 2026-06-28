import { SettingsRepository } from "../../ports/SettingsRepository";

export class UpdateGoogleCredentials {
  constructor(private readonly settings: SettingsRepository) {}

  async execute(clientId: string, clientSecret: string) {
    const current = await this.settings.get();
    await this.settings.save({
      ...current,
      googleClientId: (clientId || "").trim(),
      googleClientSecret: (clientSecret || "").trim(),
    });
  }
}
