import { PlayerPort } from "../../ports/PlayerPort";

export class PlayPause {
  constructor(private readonly player: PlayerPort) {}

  async play() {
    await this.player.play();
  }
  async pause() {
    await this.player.pause();
  }
}
