import { QueueService } from "../../services/QueueService";
import { PlayerPort } from "../../ports/PlayerPort";
import { toPlayableMedia } from "../../services/toPlayableMedia";

export class Next {
  constructor(
    private readonly queue: QueueService,
    private readonly player: PlayerPort
  ) {}

  async execute() {
    const next = this.queue.next();
    if (!next) return null;

    await this.player.load(toPlayableMedia(next));
    await this.player.play();
    return next;
  }
}
