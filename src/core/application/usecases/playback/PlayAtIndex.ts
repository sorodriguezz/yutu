import { QueueService } from "../../services/QueueService";
import { PlayerPort } from "../../ports/PlayerPort";
import { toPlayableMedia } from "../../services/toPlayableMedia";

export class PlayAtIndex {
  constructor(
    private readonly queue: QueueService,
    private readonly player: PlayerPort
  ) {}

  async execute(index: number) {
    const track = this.queue.playAt(index);
    if (!track) return null;

    await this.player.load(toPlayableMedia(track));
    await this.player.play();
    return track;
  }
}
