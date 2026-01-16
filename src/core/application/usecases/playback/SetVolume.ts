import { PlayerPort } from "../../ports/PlayerPort";

export class SetVolume {
  constructor(private readonly player: PlayerPort) {}

  async execute(vol: number) {
    const v = Math.max(0, Math.min(100, Math.round(Number(vol))));
    await this.player.setVolume(v);
  }
}
