import { WebContents } from "electron";
import { PlayerPort } from "../../../core/application/ports/PlayerPort";

export class ElectronYouTubePlayer implements PlayerPort {
  private readonly webContents: WebContents;

  constructor(webContents: WebContents) {
    this.webContents = webContents;
  }

  async load(videoId: string): Promise<void> {
    this.webContents.send('player:load', videoId);
  }

  async play(): Promise<void> {
    this.webContents.send('player:play');
  }

  async pause(): Promise<void> {
    this.webContents.send('player:pause');
  }

  async seek(seconds: number): Promise<void> {
    this.webContents.send('player:seek', seconds);
  }

  async setVolume(volume0to100: number): Promise<void> {
    const v = Math.max(0, Math.min(100, Math.round(volume0to100)));
    this.webContents.send('player:setVolume', v);
  }
}