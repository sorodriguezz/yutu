import { SettingsRepository } from "../../ports/SettingsRepository";

export type ThemeInput = {
  accentColor?: string;
  accentSecondary?: string;
  palette?: string;
};

/**
 * Guarda la paleta synthwave: color de acento + neón secundario opcional + id de paleta.
 * Un secundario vacío significa "derivar el complementario del acento".
 */
export class UpdateTheme {
  constructor(private readonly repo: SettingsRepository) {}

  async execute(input: ThemeInput) {
    const s = await this.repo.get();
    const accent = String(input.accentColor ?? "").trim() || s.accentColor;
    const secondary = String(input.accentSecondary ?? "").trim();
    const palette = String(input.palette ?? "").trim() || s.palette || "custom";
    const updated = {
      ...s,
      accentColor: accent,
      accentSecondary: secondary || undefined,
      palette,
    };
    await this.repo.save(updated);
    return updated;
  }
}
