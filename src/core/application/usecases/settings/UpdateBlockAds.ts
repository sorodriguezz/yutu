import { SettingsRepository } from "../../ports/SettingsRepository";

export class UpdateBlockAds {
  constructor(private readonly repo: SettingsRepository) {}

  async execute(enabled: boolean) {
    const s = await this.repo.get();
    const updated = { ...s, blockAds: !!enabled };
    await this.repo.save(updated);
    return updated;
  }
}
