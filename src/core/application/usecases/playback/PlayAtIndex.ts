import { QueueService } from "../../services/QueueService";
import { PlayerPort } from "../../ports/PlayerPort";

export class PlayAtIndex {
  constructor(
    private readonly queue: QueueService,
    private readonly player: PlayerPort
  ) {}

  async execute(index: number) {
    const track = this.queue.playAt(index);
    if (!track) return null;

    await this.player.load(track.videoId);
    await this.player.play();
    return track;
  }
}
