import { SettingsRepository } from "../../ports/SettingsRepository";

export class UpdateDownloadDir {
  constructor(private readonly repo: SettingsRepository) {}

  async execute(dir: string) {
    const s = await this.repo.get();
    const d = String(dir ?? "").trim();
    const updated = { ...s, downloadDir: d || undefined };
    await this.repo.save(updated);
    return updated;
  }
}
