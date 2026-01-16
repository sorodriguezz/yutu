import { BrowserWindow, ipcMain, WebContentsView } from "electron";
import crypto from "node:crypto";
import { parseVideoId } from "../infra/util/youtube";
import { AppContainer } from "../di/container";

export function registerIpc(
  win: () => BrowserWindow | null, 
  c: AppContainer,
  getPlayerView?: () => WebContentsView | null,
  toggleVideoHandler?: () => boolean
) {
  // Track player state
  let isPlaying = false;

  // Initialize YouTube search with saved API key
  (async () => {
    try {
      const settings = await c.settingsRepo.get();
      if (settings.youtubeApiKey) {
        c.youtubeSearch.setApiKey(settings.youtubeApiKey);
      }
    } catch (error) {
      console.error('Error loading YouTube API key from settings:', error);
    }
  })();

  // App state
  ipcMain.handle('app:getState', async () => c.uc.app.getState());

  // Playlists
  ipcMain.handle('playlist:create', async (_e, name: string) => 
    c.uc.playlist.create.execute(name));
  
  ipcMain.handle('playlist:delete', async (_e, playlistId: string) => 
    c.uc.playlist.delete.execute(playlistId));
  
  ipcMain.handle('playlist:addTrack', async (_e, playlistId: string, track: { videoId: string; title?: string }) =>
    c.uc.playlist.addTrack.execute(playlistId, track)
  );
  
  ipcMain.handle('playlist:removeTrack', async (_e, playlistId: string, trackId: string) =>
    c.uc.playlist.removeTrack.execute(playlistId, trackId)
  );
  
  ipcMain.handle('playlist:export', async (_e, playlistId: string) => 
    c.uc.playlist.export.execute(playlistId));
  
  ipcMain.handle('playlist:import', async () => 
    c.uc.playlist.import.execute());

  // Queue/Playback
  ipcMain.handle('queue:enqueueTrack', async (_e, urlOrId: string) => {
    const videoId = parseVideoId(urlOrId);
    if (!videoId) throw new Error('URL o VideoId inválido');
    
    // Get video info from YouTube
    let videoInfo;
    try {
      videoInfo = await c.youtubeSearch.getVideoInfo(videoId);
    } catch (error) {
      console.warn('Could not fetch video info:', error);
    }
    
    const track = {
      id: crypto.randomUUID(),
      provider: 'youtube' as const,
      videoId,
      title: videoInfo?.title || videoId,
      author: videoInfo?.author,
      thumbnail: videoInfo?.thumbnail || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      duration: videoInfo?.duration,
      addedAt: Date.now()
    };
    return c.uc.playback.enqueueTrack.execute(track);
  });
  
  ipcMain.handle('queue:enqueuePlaylist', async (_e, playlistId: string, startIndex: number = 0) => {
    const result = await c.uc.playback.enqueuePlaylist.execute(playlistId, startIndex);
    sendQueueUpdate();
    return result;
  });
  
  ipcMain.handle('playback:next', async () => {
    await c.uc.playback.next.execute();
    sendQueueUpdate();
  });
  
  ipcMain.handle('playback:prev', async () => {
    await c.uc.playback.prev.execute();
    sendQueueUpdate();
  });
  
  ipcMain.handle('queue:toggleShuffle', async () => {
    await c.uc.playback.toggleShuffle.execute();
    sendQueueUpdate();
  });
  
  ipcMain.handle('queue:cycleRepeat', async () => {
    await c.uc.playback.cycleRepeat.execute();
    sendQueueUpdate();
  });

  // Player controls
  ipcMain.handle('playback:playPause', async () => {
    if (isPlaying) {
      await c.player.pause();
    } else {
      await c.player.play();
    }
    // isPlaying will be updated by the player:stateChanged event
    return { isPlaying: !isPlaying };
  });
  
  // Update isPlaying when playAtIndex is called
  ipcMain.handle('playback:playAtIndex', async (_e, index: number) => {
    const result = await c.uc.playback.playAt.execute(index);
    if (result) {
      isPlaying = true;
      sendQueueUpdate();
    }
    return result;
  });
  
  ipcMain.handle('playback:seek', async (_e, seconds: number) => 
    c.uc.playback.seek.execute(seconds));
  
  ipcMain.handle('playback:setVolume', async (_e, vol: number) => 
    c.uc.playback.setVolume.execute(vol));

  // Settings
  ipcMain.handle('settings:setAccent', async (_e, color: string) => 
    c.uc.settings.setAccent.execute(color));
  
  ipcMain.handle('settings:setVolumeDefault', async (_e, vol: number) => 
    c.uc.settings.setVolumeDefault.execute(vol));

  ipcMain.handle('settings:setYouTubeApiKey', async (_e, apiKey: string) => {
    await c.uc.settings.setYouTubeApiKey.execute(apiKey);
    // Update the YouTube search adapter with the new API key
    c.youtubeSearch.setApiKey(apiKey);
  });

  // YouTube Search
  ipcMain.handle('youtube:search', async (_e, query: string) => 
    c.uc.playback.searchYouTube.execute(query));

  // Video visibility toggle
  ipcMain.handle('player:toggleVideo', async (_e, visible: boolean) => {
    if (toggleVideoHandler) {
      const newVisibility = toggleVideoHandler();
      return { success: true, visible: newVisibility };
    }
    return { success: false, visible };
  });

  // Player events from player window
  ipcMain.on('player:stateChanged', (_e, state: string) => {
    // Update isPlaying state to sync with actual player state
    isPlaying = state === 'playing';
    win()?.webContents.send('player:state', state);
  });

  ipcMain.on('player:timeUpdate', (_e, data: any) => {
    win()?.webContents.send('player:timeUpdate', data);
  });

  ipcMain.on('player:ended', async () => {
    // Auto-advance logic based on repeat mode
    const queueState = c.queue.getState();
    if (queueState.repeat === 'one') {
      // Replay same track
      if (queueState.index >= 0) {
        await c.uc.playback.playAt.execute(queueState.index);
      }
    } else {
      // Try next
      await c.uc.playback.next.execute();
    }
    sendQueueUpdate();
  });

  function sendQueueUpdate() {
    const queueState = c.queue.getState();
    win()?.webContents.send('queue:update', queueState);
  }

  // Send initial queue update when renderer loads
  setInterval(() => {
    if (win()?.webContents) {
      sendQueueUpdate();
    }
  }, 1000);
}
