import { SettingsRepository } from "../../ports/SettingsRepository";

export class UpdateVolumeDefault {
  constructor(private readonly repo: SettingsRepository) {}

  async execute(volume: number) {
    const s = await this.repo.get();
    const v = Math.max(0, Math.min(100, Math.round(Number(volume))));
    const updated = { ...s, volumeDefault: v };
    await this.repo.save(updated);
    return updated;
  }
}
