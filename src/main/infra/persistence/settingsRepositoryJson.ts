import { SettingsRepository, Settings } from "../../../core/application/ports/SettingsRepository";
import { JsonDb } from "./jsonDb";

export class SettingsRepositoryJson implements SettingsRepository {
  constructor(private readonly db: JsonDb) {}

  async get(): Promise<Settings> {
    return this.db.read().settings;
  }

  async save(settings: Settings): Promise<void> {
    const current = this.db.read();
    this.db.write({ ...current, settings });
  }
}