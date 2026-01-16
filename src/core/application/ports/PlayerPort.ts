export interface PlayerPort {
  load(videoId: string): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(seconds: number): Promise<void>;
  setVolume(volume0to100: number): Promise<void>;
}