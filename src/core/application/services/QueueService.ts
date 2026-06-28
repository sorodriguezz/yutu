import { Track } from "../../domain/entities/Track";

export type RepeatMode = "off" | "all" | "one";

export class QueueService {
  private queue: Track[] = [];
  private index: number = -1;

  private shuffle = false;
  private repeat: RepeatMode = "off";

  getState() {
    return {
      queue: [...this.queue],
      index: this.index,
      shuffle: this.shuffle,
      repeat: this.repeat,
    };
  }

  setShuffle(on: boolean) {
    this.shuffle = on;
  }
  cycleRepeat() {
    if (this.repeat === "off") {
      this.repeat = "all";
    } else if (this.repeat === "all") {
      this.repeat = "one";
    } else {
      this.repeat = "off";
    }
    return this.repeat;
  }

  enqueue(track: Track) {
    this.queue.push(track);
    if (this.index === -1) this.index = 0;
  }

  enqueueMany(tracks: Track[]) {
    for (const t of tracks) this.queue.push(t);
    if (this.index === -1 && this.queue.length > 0) this.index = 0;
  }

  // Replace queue with new tracks and optionally set starting index
  replaceQueue(tracks: Track[], startIndex: number = 0) {
    this.queue = [...tracks];
    this.index = tracks.length > 0 ? Math.min(startIndex, tracks.length - 1) : -1;
  }

  clear() {
    this.queue = [];
    this.index = -1;
  }

  playAt(idx: number) {
    if (this.queue.length === 0) return null;
    if (idx < 0 || idx >= this.queue.length) return null;
    this.index = idx;
    return this.current();
  }

  // Quita una pista de la cola y ajusta el índice. Indica si se quitó la actual.
  removeAt(idx: number): { removedCurrent: boolean; empty: boolean } {
    if (idx < 0 || idx >= this.queue.length) {
      return { removedCurrent: false, empty: this.queue.length === 0 };
    }
    const wasCurrent = idx === this.index;
    this.queue.splice(idx, 1);
    if (this.queue.length === 0) this.index = -1;
    else if (idx < this.index) this.index--;
    else if (wasCurrent && this.index >= this.queue.length) this.index = this.queue.length - 1;
    return { removedCurrent: wasCurrent, empty: this.queue.length === 0 };
  }

  // Reordena la cola moviendo un elemento de una posición a otra,
  // conservando la pista que se está reproduciendo.
  move(from: number, to: number) {
    const n = this.queue.length;
    if (from < 0 || from >= n || to < 0 || to >= n || from === to) return;
    const [item] = this.queue.splice(from, 1);
    this.queue.splice(to, 0, item);
    if (this.index === from) this.index = to;
    else if (from < this.index && to >= this.index) this.index--;
    else if (from > this.index && to <= this.index) this.index++;
  }

  current() {
    if (this.index < 0 || this.index >= this.queue.length) return null;
    return this.queue[this.index];
  }

  next(): Track | null {
    if (this.queue.length === 0) return null;

    if (this.repeat === "one") return this.current();

    if (this.shuffle) {
      const nextIdx = Math.floor(Math.random() * this.queue.length);
      this.index = nextIdx;
      return this.current();
    }

    const nextIndex = this.index + 1;
    if (nextIndex >= this.queue.length) {
      if (this.repeat === "all") {
        this.index = 0;
        return this.current();
      }
      // off: se queda al final
      this.index = this.queue.length - 1;
      return null;
    }

    this.index = nextIndex;
    return this.current();
  }

  prev(): Track | null {
    if (this.queue.length === 0) return null;

    if (this.shuffle) {
      const prevIdx = Math.floor(Math.random() * this.queue.length);
      this.index = prevIdx;
      return this.current();
    }

    const prevIndex = Math.max(0, this.index - 1);
    this.index = prevIndex;
    return this.current();
  }
}
