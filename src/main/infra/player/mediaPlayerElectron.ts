import { WebContents } from "electron";
import { PlayerPort, PlayableMedia } from "../../../core/application/ports/PlayerPort";

/**
 * Drives the player WebContentsView, which can render either a YouTube iframe
 * or a native <video>/<audio> element for local files.
 */
export class ElectronMediaPlayer implements PlayerPort {
  private readonly webContents: WebContents;

  constructor(webContents: WebContents) {
    this.webContents = webContents;
  }

  async load(media: PlayableMedia): Promise<void> {
    this.webContents.send("player:load", media);
  }

  async crossfade(media: PlayableMedia, durationSec: number): Promise<void> {
    this.webContents.send("player:crossfade", { media, durationSec });
  }

  async play(): Promise<void> {
    this.webContents.send("player:play");
  }

  async pause(): Promise<void> {
    this.webContents.send("player:pause");
  }

  async seek(seconds: number): Promise<void> {
    this.webContents.send("player:seek", seconds);
  }

  async setVolume(volume0to100: number): Promise<void> {
    const v = Math.max(0, Math.min(100, Math.round(volume0to100)));
    this.webContents.send("player:setVolume", v);
  }

  async setRate(rate: number): Promise<void> {
    const r = Math.max(0.25, Math.min(2, rate));
    this.webContents.send("player:setRate", r);
  }

  async setEq(gains: number[]): Promise<void> {
    this.webContents.send("player:setEq", gains);
  }
}
