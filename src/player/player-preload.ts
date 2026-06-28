import { contextBridge, ipcRenderer } from "electron";

// Expose player-specific API
contextBridge.exposeInMainWorld('playerApi', {
  // Commands from main
  onLoad: (callback: (videoId: string) => void) => {
    ipcRenderer.on('player:load', (_, videoId) => callback(videoId));
  },
  onCrossfade: (callback: (payload: { media: any; durationSec: number }) => void) => {
    ipcRenderer.on('player:crossfade', (_, payload) => callback(payload));
  },
  onPlay: (callback: () => void) => {
    ipcRenderer.on('player:play', () => callback());
  },
  onPause: (callback: () => void) => {
    ipcRenderer.on('player:pause', () => callback());
  },
  onSeek: (callback: (seconds: number) => void) => {
    ipcRenderer.on('player:seek', (_, seconds) => callback(seconds));
  },
  onSetVolume: (callback: (volume: number) => void) => {
    ipcRenderer.on('player:setVolume', (_, volume) => callback(volume));
  },
  onSetRate: (callback: (rate: number) => void) => {
    ipcRenderer.on('player:setRate', (_, rate) => callback(rate));
  },
  onSetEq: (callback: (gains: number[]) => void) => {
    ipcRenderer.on('player:setEq', (_, gains) => callback(gains));
  },
  sendLevels: (levels: number[]) => {
    ipcRenderer.send('player:levels', levels);
  },

  // Events to main
  sendPlayerState: (state: string) => {
    ipcRenderer.send('player:stateChanged', state);
  },
  sendTimeUpdate: (data: any) => {
    ipcRenderer.send('player:timeUpdate', data);
  },
  notifyEnded: () => {
    ipcRenderer.send('player:ended');
  }
});

declare global {
  interface Window {
    playerApi: any;
  }
}