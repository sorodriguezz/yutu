import { QueueService } from "../../services/QueueService";
import { PlayerPort } from "../../ports/PlayerPort";
import { toPlayableMedia } from "../../services/toPlayableMedia";

export class Prev {
  constructor(
    private readonly queue: QueueService,
    private readonly player: PlayerPort
  ) {}

  async execute() {
    const prev = this.queue.prev();
    if (!prev) return null;

    await this.player.load(toPlayableMedia(prev));
    await this.player.play();
    return prev;
  }
}
