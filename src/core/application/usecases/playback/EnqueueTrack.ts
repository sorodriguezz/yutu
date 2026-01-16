import { QueueService } from "../../services/QueueService";
import { Track } from "../../../domain/entities/Track";

export class EnqueueTrack {
  constructor(private readonly queue: QueueService) {}

  async execute(track: Track) {
    this.queue.enqueue(track);
    return this.queue.getState();
  }
}
