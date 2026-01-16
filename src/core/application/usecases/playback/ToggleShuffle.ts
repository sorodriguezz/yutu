import { QueueService } from "../../services/QueueService";

export class ToggleShuffle {
  constructor(private readonly queue: QueueService) {}

  async execute() {
    const state = this.queue.getState();
    this.queue.setShuffle(!state.shuffle);
    return this.queue.getState();
  }
}
