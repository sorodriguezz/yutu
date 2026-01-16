import { QueueService } from "../../services/QueueService";

export class CycleRepeat {
  constructor(private readonly queue: QueueService) {}

  async execute() {
    const mode = this.queue.cycleRepeat();
    return { repeat: mode };
  }
}
