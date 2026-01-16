import fs from "node:fs";
import path from "node:path";
import { Playlist } from "../../../core/domain/entities/Playlist";
import { Settings } from "../../../core/application/ports/SettingsRepository";

export type DbShape = {
  playlists: Playlist[];
  settings: Settings;
};

export class JsonDb {
  constructor(
    private readonly filePath: string,
    private readonly defaultDb: DbShape
  ) {}

  read(): DbShape {
    try {
      if (!fs.existsSync(this.filePath)) return this.defaultDb;
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as DbShape;

      return {
        playlists: parsed.playlists ?? [],
        settings: parsed.settings ?? this.defaultDb.settings,
      };
    } catch {
      return this.defaultDb;
    }
  }

  write(db: DbShape) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(db, null, 2), "utf-8");
  }
}
