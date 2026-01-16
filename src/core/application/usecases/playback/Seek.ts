import { PlayerPort } from "../../ports/PlayerPort";

export class Seek {
  constructor(private readonly player: PlayerPort) {}

  async execute(seconds: number) {
    const s = Number(seconds);
    if (Number.isNaN(s) || s < 0) return;
    await this.player.seek(s);
  }
}
