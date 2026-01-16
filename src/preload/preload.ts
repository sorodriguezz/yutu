import { contextBridge, ipcRenderer } from "electron";

// Expose safe API to renderer
contextBridge.exposeInMainWorld('api', {
  // State
  getState: () => ipcRenderer.invoke('app:getState'),

  // Playback
  playPause: () => ipcRenderer.invoke('playback:playPause'),
  next: () => ipcRenderer.invoke('playback:next'),
  prev: () => ipcRenderer.invoke('playback:prev'),
  seek: (seconds: number) => ipcRenderer.invoke('playback:seek', seconds),
  setVolume: (volume: number) => ipcRenderer.invoke('playback:setVolume', volume),
  playAtIndex: (index: number) => ipcRenderer.invoke('playback:playAtIndex', index),

  // Queue
  enqueueTrack: (urlOrId: string) => ipcRenderer.invoke('queue:enqueueTrack', urlOrId),
  enqueuePlaylist: (playlistId: string, startIndex?: number) => ipcRenderer.invoke('queue:enqueuePlaylist', playlistId, startIndex || 0),
  toggleShuffle: () => ipcRenderer.invoke('queue:toggleShuffle'),
  cycleRepeat: () => ipcRenderer.invoke('queue:cycleRepeat'),

  // YouTube Search
  searchYouTube: (query: string) => ipcRenderer.invoke('youtube:search', query),

  // Playlists
  createPlaylist: (name: string) => ipcRenderer.invoke('playlist:create', name),
  deletePlaylist: (id: string) => ipcRenderer.invoke('playlist:delete', id),
  addTrackToPlaylist: (playlistId: string, track: { videoId: string; title?: string }) => 
    ipcRenderer.invoke('playlist:addTrack', playlistId, track),
  removeTrackFromPlaylist: (playlistId: string, trackId: string) =>
    ipcRenderer.invoke('playlist:removeTrack', playlistId, trackId),
  exportPlaylist: (id: string) => ipcRenderer.invoke('playlist:export', id),
  importPlaylist: () => ipcRenderer.invoke('playlist:import'),

  // Settings
  setAccentColor: (color: string) => ipcRenderer.invoke('settings:setAccent', color),
  setVolumeDefault: (volume: number) => ipcRenderer.invoke('settings:setVolumeDefault', volume),
  setYouTubeApiKey: (apiKey: string) => ipcRenderer.invoke('settings:setYouTubeApiKey', apiKey),

  // Video visibility
  toggleVideo: (visible: boolean) => ipcRenderer.invoke('player:toggleVideo', visible),

  // Events from main
  onPlayerState: (callback: (state: string) => void) => {
    ipcRenderer.on('player:state', (_, state) => callback(state));
  },
  onTimeUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('player:timeUpdate', (_, data) => callback(data));
  },
  onQueueUpdate: (callback: (queue: any) => void) => {
    ipcRenderer.on('queue:update', (_, queue) => callback(queue));
  }
});

declare global {
  interface Window {
    api: any;
  }
}
