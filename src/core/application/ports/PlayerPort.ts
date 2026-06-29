import { MediaType, TrackProvider } from "../../domain/entities/Track";

/**
 * A provider-agnostic descriptor of something playable.
 * The concrete adapter decides how to render it (YouTube iframe vs. <video>).
 */
export type PlayableMedia = {
  provider: TrackProvider;
  videoId?: string; // youtube
  filePath?: string; // local
  mediaType?: MediaType; // local
  title?: string;
};

export interface PlayerPort {
  load(media: PlayableMedia): Promise<void>;
  /** Funde a la siguiente pista (audio local) sobre `durationSec` segundos. */
  crossfade(media: PlayableMedia, durationSec: number): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(seconds: number): Promise<void>;
  setVolume(volume0to100: number): Promise<void>;
  setRate(rate: number): Promise<void>;
  setEq(gains: number[]): Promise<void>;
}
