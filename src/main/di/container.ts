import path from "node:path";
import { app, BrowserWindow, WebContentsView } from "electron";

import { JsonDb } from "../infra/persistence/jsonDb";
import { PlaylistRepositoryJson } from "../infra/persistence/playlistRepositoryJson";
import { SettingsRepositoryJson } from "../infra/persistence/settingsRepositoryJson";
import { ElectronFileDialog } from "../infra/io/fileDialogElectron";
import { ElectronArchiveAdapter } from "../infra/io/electronArchiveAdapter";
import { ElectronMediaPlayer } from "../infra/player/mediaPlayerElectron";
import { GoogleAuthAdapter } from "../infra/auth/googleAuthAdapter";
import { ConsoleLogger } from "../infra/logging/consoleLogger";
import { makeId } from "../infra/util/ids";
import { DEFAULT_GOOGLE_CLIENT_ID } from "../config";

import { QueueService } from "../../core/application/services/QueueService";

import { CreatePlaylist } from "../../core/application/usecases/playlists/CreatePlaylist";
import { DeletePlaylist } from "../../core/application/usecases/playlists/DeletePlaylist";
import { AddTrackToPlaylist } from "../../core/application/usecases/playlists/AddTrackToPlaylist";
import { RemoveTrackFromPlaylist } from "../../core/application/usecases/playlists/RemoveTrackFromPlaylist";
import { ExportPlaylist } from "../../core/application/usecases/playlists/ExportPlaylist";
import { ImportPlaylist } from "../../core/application/usecases/playlists/ImportPlaylist";
import { SetPlaylistCover } from "../../core/application/usecases/playlists/SetPlaylistCover";

import { EnqueueTrack } from "../../core/application/usecases/playback/EnqueueTrack";
import { EnqueueTracks } from "../../core/application/usecases/playback/EnqueueTracks";
import { EnqueuePlaylist } from "../../core/application/usecases/playback/EnqueuePlaylist";
import { PlayAtIndex } from "../../core/application/usecases/playback/PlayAtIndex";
import { PlayPause } from "../../core/application/usecases/playback/PlayPause";
import { Next } from "../../core/application/usecases/playback/Next";
import { Prev } from "../../core/application/usecases/playback/Prev";
import { Seek } from "../../core/application/usecases/playback/Seek";
import { SetVolume } from "../../core/application/usecases/playback/SetVolume";
import { ToggleShuffle } from "../../core/application/usecases/playback/ToggleShuffle";
import { CycleRepeat } from "../../core/application/usecases/playback/CycleRepeat";

import { UpdateAccentColor } from "../../core/application/usecases/settings/UpdateAccentColor";
import { UpdateVolumeDefault } from "../../core/application/usecases/settings/UpdateVolumeDefault";
import { UpdateYouTubeApiKey } from "../../core/application/usecases/settings/UpdateYouTubeApiKey";
import { UpdateGoogleCredentials } from "../../core/application/usecases/settings/UpdateGoogleCredentials";
import { UpdateCrossfade } from "../../core/application/usecases/settings/UpdateCrossfade";
import { UpdateLanguage } from "../../core/application/usecases/settings/UpdateLanguage";
import { UpdateTheme } from "../../core/application/usecases/settings/UpdateTheme";
import { UpdateBlockAds } from "../../core/application/usecases/settings/UpdateBlockAds";
import { UpdateDownloadDir } from "../../core/application/usecases/settings/UpdateDownloadDir";
import { DownloadAudio } from "../../core/application/usecases/download/DownloadAudio";
import { YtDlpDownloader } from "../infra/download/ytDlpDownloader";
import { SearchYouTube } from "../../core/application/usecases/playback/SearchYouTube";

import { SignInGoogle } from "../../core/application/usecases/auth/SignInGoogle";
import { SignOutGoogle } from "../../core/application/usecases/auth/SignOutGoogle";
import { GetAuthProfile } from "../../core/application/usecases/auth/GetAuthProfile";
import { ListYouTubePlaylists } from "../../core/application/usecases/auth/ListYouTubePlaylists";
import { ImportYouTubePlaylist } from "../../core/application/usecases/auth/ImportYouTubePlaylist";

import { YouTubeSearchAdapter } from "../infra/youtube/youtubeSearchAdapter";

export type AppContainer = ReturnType<typeof buildContainer>;

export function buildContainer(opts: {
  getWindow: () => BrowserWindow | null;
  playerView: WebContentsView;
}) {
  const logger = new ConsoleLogger();

  const dbFile = path.join(app.getPath("userData"), "db.json");
  const db = new JsonDb(dbFile, {
    playlists: [],
    settings: {
      accentColor: "#ff2e97",
      volumeDefault: 60,
      youtubeApiKey: "",
      palette: "miami",
      language: "es",
      crossfadeSec: 5,
      blockAds: true,
    }
  });

  const playlistRepo = new PlaylistRepositoryJson(db);
  const settingsRepo = new SettingsRepositoryJson(db);
  const fileDialog = new ElectronFileDialog(opts.getWindow);
  const archive = new ElectronArchiveAdapter(opts.getWindow);
  const player = new ElectronMediaPlayer(opts.playerView.webContents);
  const auth = new GoogleAuthAdapter(settingsRepo);
  const downloader = new YtDlpDownloader();

  // YouTube search adapter will be initialized with API key from settings
  const youtubeSearch = new YouTubeSearchAdapter(""); // Will be updated via setApiKey

  const queue = new QueueService();

  // Use cases
  const uc = {
    app: {
      getState: async () => {
        const playlists = await playlistRepo.getAll();
        const settings = await settingsRepo.get();
        const queueState = queue.getState();
        // Don't leak secrets/tokens to the renderer
        const safeSettings = {
          accentColor: settings.accentColor,
          accentSecondary: settings.accentSecondary,
          palette: settings.palette,
          language: settings.language || "es",
          crossfadeSec: settings.crossfadeSec ?? 0,
          blockAds: settings.blockAds ?? true,
          downloadDir: settings.downloadDir,
          volumeDefault: settings.volumeDefault,
          youtubeApiKey: settings.youtubeApiKey,
          googleClientId: settings.googleClientId,
          hasGoogleSecret: !!settings.googleClientSecret,
          googleConfigured: !!(settings.googleClientId || DEFAULT_GOOGLE_CLIENT_ID),
          profile: settings.auth?.profile ?? null,
        };
        return { playlists, settings: safeSettings, queue: queueState };
      }
    },
    playlist: {
      create: new CreatePlaylist(playlistRepo, makeId),
      delete: new DeletePlaylist(playlistRepo),
      addTrack: new AddTrackToPlaylist(playlistRepo, makeId),
      removeTrack: new RemoveTrackFromPlaylist(playlistRepo),
      export: new ExportPlaylist(playlistRepo, archive),
      import: new ImportPlaylist(playlistRepo, archive, makeId),
      setCover: new SetPlaylistCover(playlistRepo)
    },
    playback: {
      enqueueTrack: new EnqueueTrack(queue),
      enqueueTracks: new EnqueueTracks(queue),
      enqueuePlaylist: new EnqueuePlaylist(playlistRepo, queue),
      playAt: new PlayAtIndex(queue, player),
      playPause: new PlayPause(player),
      next: new Next(queue, player),
      prev: new Prev(queue, player),
      seek: new Seek(player),
      setVolume: new SetVolume(player),
      toggleShuffle: new ToggleShuffle(queue),
      cycleRepeat: new CycleRepeat(queue),
      searchYouTube: new SearchYouTube(youtubeSearch)
    },
    settings: {
      setAccent: new UpdateAccentColor(settingsRepo),
      setVolumeDefault: new UpdateVolumeDefault(settingsRepo),
      setYouTubeApiKey: new UpdateYouTubeApiKey(settingsRepo),
      setGoogleCredentials: new UpdateGoogleCredentials(settingsRepo),
      setCrossfade: new UpdateCrossfade(settingsRepo),
      setLanguage: new UpdateLanguage(settingsRepo),
      setTheme: new UpdateTheme(settingsRepo),
      setBlockAds: new UpdateBlockAds(settingsRepo),
      setDownloadDir: new UpdateDownloadDir(settingsRepo)
    },
    download: {
      audio: new DownloadAudio(downloader)
    },
    auth: {
      signIn: new SignInGoogle(auth),
      signOut: new SignOutGoogle(auth),
      getProfile: new GetAuthProfile(auth),
      listYouTubePlaylists: new ListYouTubePlaylists(auth),
      importYouTubePlaylist: new ImportYouTubePlaylist(auth, playlistRepo, makeId)
    },
    ports: { logger, youtubeSearch, auth }
  };

  return { uc, playlistRepo, settingsRepo, queue, player, fileDialog, auth, logger, youtubeSearch, downloader };
}