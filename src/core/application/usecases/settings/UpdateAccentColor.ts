import { SettingsRepository } from "../../ports/SettingsRepository";

export class UpdateAccentColor {
  constructor(private readonly repo: SettingsRepository) {}

  async execute(color: string) {
    const s = await this.repo.get();
    const c = String(color ?? "").trim();
    const updated = { ...s, accentColor: c || s.accentColor };
    await this.repo.save(updated);
    return updated;
  }
}
