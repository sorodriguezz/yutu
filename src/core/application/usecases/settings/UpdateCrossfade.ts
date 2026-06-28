import { SettingsRepository } from "../../ports/SettingsRepository";

export class UpdateCrossfade {
  constructor(private readonly repo: SettingsRepository) {}

  async execute(seconds: number) {
    const s = await this.repo.get();
    const v = Math.max(0, Math.min(12, Math.round(Number(seconds) || 0)));
    const updated = { ...s, crossfadeSec: v };
    await this.repo.save(updated);
    return updated;
  }
}
