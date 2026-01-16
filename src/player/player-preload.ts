import { contextBridge, ipcRenderer } from "electron";

// Expose player-specific API
contextBridge.exposeInMainWorld('playerApi', {
  // Commands from main
  onLoad: (callback: (videoId: string) => void) => {
    ipcRenderer.on('player:load', (_, videoId) => callback(videoId));
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