import { DomainError } from "../errors/DomainError";

export class VideoId {
  private constructor(public readonly value: string) {}

  static create(raw: string): VideoId {
    const v = String(raw ?? "").trim();

    if (!/^[a-zA-Z0-9_-]{11}$/.test(v)) {
      throw new DomainError("VideoId inválido (debe tener 11 caracteres).");
    }

    return new VideoId(v);
  }
}
