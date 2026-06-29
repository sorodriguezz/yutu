import { SettingsRepository } from "../../ports/SettingsRepository";

const ALLOWED = new Set(["es", "en"]);

export class UpdateLanguage {
  constructor(private readonly repo: SettingsRepository) {}

  async execute(lang: string) {
    const s = await this.repo.get();
    const l = String(lang ?? "").trim().toLowerCase();
    const updated = { ...s, language: ALLOWED.has(l) ? l : (s.language || "es") };
    await this.repo.save(updated);
    return updated;
  }
}
