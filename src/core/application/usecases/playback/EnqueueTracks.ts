import { QueueService } from "../../services/QueueService";
import { Track } from "../../../domain/entities/Track";

export class EnqueueTracks {
  constructor(private readonly queue: QueueService) {}

  async execute(tracks: Track[]) {
    this.queue.enqueueMany(tracks);
    return this.queue.getState();
  }
}
