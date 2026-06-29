import { contextBridge, ipcRenderer, webUtils } from "electron";

// Expose safe API to renderer
contextBridge.exposeInMainWorld('api', {
  // State
  getState: () => ipcRenderer.invoke('app:getState'),

  // Resuelve la ruta absoluta de un File arrastrado (Electron webUtils)
  getPathForFile: (file: File) => {
    try { return webUtils.getPathForFile(file); } catch { return ''; }
  },

  // Playback
  playPause: () => ipcRenderer.invoke('playback:playPause'),
  next: () => ipcRenderer.invoke('playback:next'),
  prev: () => ipcRenderer.invoke('playback:prev'),
  seek: (seconds: number) => ipcRenderer.invoke('playback:seek', seconds),
  setVolume: (volume: number) => ipcRenderer.invoke('playback:setVolume', volume),
  setRate: (rate: number) => ipcRenderer.invoke('playback:setRate', rate),
  setEq: (gains: number[]) => ipcRenderer.invoke('playback:setEq', gains),
  playAtIndex: (index: number) => ipcRenderer.invoke('playback:playAtIndex', index),

  // Queue
  enqueueTrack: (urlOrId: string) => ipcRenderer.invoke('queue:enqueueTrack', urlOrId),
  enqueuePlaylist: (playlistId: string, startIndex?: number) => ipcRenderer.invoke('queue:enqueuePlaylist', playlistId, startIndex || 0),
  toggleShuffle: () => ipcRenderer.invoke('queue:toggleShuffle'),
  cycleRepeat: () => ipcRenderer.invoke('queue:cycleRepeat'),
  moveInQueue: (from: number, to: number) => ipcRenderer.invoke('queue:move', from, to),
  removeFromQueue: (index: number) => ipcRenderer.invoke('queue:remove', index),
  appendPlaylistToQueue: (playlistId: string) => ipcRenderer.invoke('queue:appendPlaylist', playlistId),
  appendTrackToQueue: (track: any) => ipcRenderer.invoke('queue:appendTrack', track),
  playPlaylistShuffled: (playlistId: string) => ipcRenderer.invoke('queue:playShuffled', playlistId),

  // YouTube Search
  searchYouTube: (query: string) => ipcRenderer.invoke('youtube:search', query),
  importYouTubePlaylistUrl: (url: string) => ipcRenderer.invoke('youtube:importPlaylistUrl', url),

  // Local files
  addLocalFiles: () => ipcRenderer.invoke('local:pickAndEnqueue'),
  enqueueLocalPaths: (paths: string[]) => ipcRenderer.invoke('local:enqueuePaths', paths),

  // Google account / auth
  signInGoogle: () => ipcRenderer.invoke('auth:signIn'),
  signOutGoogle: () => ipcRenderer.invoke('auth:signOut'),
  getAuthProfile: () => ipcRenderer.invoke('auth:getProfile'),
  listYouTubePlaylists: () => ipcRenderer.invoke('auth:listYouTubePlaylists'),
  importYouTubePlaylist: (playlistId: string, name: string) =>
    ipcRenderer.invoke('auth:importYouTubePlaylist', playlistId, name),
  setGoogleCredentials: (clientId: string, clientSecret: string) =>
    ipcRenderer.invoke('settings:setGoogleCredentials', clientId, clientSecret),

  // Playlists
  createPlaylist: (name: string) => ipcRenderer.invoke('playlist:create', name),
  deletePlaylist: (id: string) => ipcRenderer.invoke('playlist:delete', id),
  addTrackToPlaylist: (playlistId: string, track: any) =>
    ipcRenderer.invoke('playlist:addTrack', playlistId, track),
  removeTrackFromPlaylist: (playlistId: string, trackId: string) =>
    ipcRenderer.invoke('playlist:removeTrack', playlistId, trackId),
  exportPlaylist: (id: string) => ipcRenderer.invoke('playlist:export', id),
  importPlaylist: () => ipcRenderer.invoke('playlist:import'),
  setPlaylistCover: (id: string, cover: string) => ipcRenderer.invoke('playlist:setCover', id, cover),

  // Settings
  setAccentColor: (color: string) => ipcRenderer.invoke('settings:setAccent', color),
  setVolumeDefault: (volume: number) => ipcRenderer.invoke('settings:setVolumeDefault', volume),
  setYouTubeApiKey: (apiKey: string) => ipcRenderer.invoke('settings:setYouTubeApiKey', apiKey),
  setCrossfade: (seconds: number) => ipcRenderer.invoke('settings:setCrossfade', seconds),
  setLanguage: (lang: string) => ipcRenderer.invoke('settings:setLanguage', lang),
  setTheme: (theme: { accentColor?: string; accentSecondary?: string; palette?: string }) =>
    ipcRenderer.invoke('settings:setTheme', theme),
  setBlockAds: (enabled: boolean) => ipcRenderer.invoke('settings:setBlockAds', enabled),
  setDownloadDir: (dir: string) => ipcRenderer.invoke('settings:setDownloadDir', dir),
  chooseDownloadDir: () => ipcRenderer.invoke('settings:chooseDownloadDir'),

  // YouTube Music + descargas
  toggleYtMusic: (visible: boolean) => ipcRenderer.invoke('ytm:toggle', visible),
  ytmHome: () => ipcRenderer.invoke('ytm:home'),
  ytmBack: () => ipcRenderer.invoke('ytm:back'),
  downloadByVideoId: (videoId: string, title?: string) => ipcRenderer.invoke('download:byVideoId', videoId, title),
  downloadCurrentYtm: () => ipcRenderer.invoke('download:currentYtm'),
  openDownloadsFolder: () => ipcRenderer.invoke('download:openFolder'),
  onDownloadProgress: (callback: (p: any) => void) => {
    ipcRenderer.on('download:progress', (_, p) => callback(p));
  },

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
  },
  onLevels: (callback: (levels: number[]) => void) => {
    ipcRenderer.on('player:levels', (_, levels) => callback(levels));
  }
});

declare global {
  interface Window {
    api: any;
  }
}
