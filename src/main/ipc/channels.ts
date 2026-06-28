export const Channels = {
  App_GetState: "app:getState",

  Playlist_Create: "playlist:create",
  Playlist_Delete: "playlist:delete",
  Playlist_AddTrack: "playlist:addTrack",
  Playlist_RemoveTrack: "playlist:removeTrack",
  Playlist_Export: "playlist:export",
  Playlist_Import: "playlist:import",
  Playlist_SetCover: "playlist:setCover",

  Queue_EnqueueTrack: "queue:enqueueTrack",
  Queue_EnqueuePlaylist: "queue:enqueuePlaylist",
  Queue_PlayAt: "queue:playAt",
  Queue_Next: "queue:next",
  Queue_Prev: "queue:prev",
  Queue_ToggleShuffle: "queue:toggleShuffle",
  Queue_CycleRepeat: "queue:cycleRepeat",
  Queue_Move: "queue:move",
  Queue_Remove: "queue:remove",
  Queue_AppendPlaylist: "queue:appendPlaylist",
  Queue_AppendTrack: "queue:appendTrack",
  Queue_PlayShuffled: "queue:playShuffled",

  YouTube_Search: "youtube:search",
  YouTube_ImportPlaylistUrl: "youtube:importPlaylistUrl",

  Local_PickAndEnqueue: "local:pickAndEnqueue",
  Local_EnqueuePaths: "local:enqueuePaths",

  Playback_SetRate: "playback:setRate",

  Auth_SignIn: "auth:signIn",
  Auth_SignOut: "auth:signOut",
  Auth_GetProfile: "auth:getProfile",
  Auth_ListYouTubePlaylists: "auth:listYouTubePlaylists",
  Auth_ImportYouTubePlaylist: "auth:importYouTubePlaylist",

  Player_Play: "player:play",
  Player_Pause: "player:pause",
  Player_Seek: "player:seek",
  Player_SetVolume: "player:setVolume",

  Settings_SetAccent: "settings:setAccent",
  Settings_SetVolumeDefault: "settings:setVolumeDefault",
  Settings_SetYouTubeApiKey: "settings:setYouTubeApiKey",
  Settings_SetGoogleCredentials: "settings:setGoogleCredentials",

  Util_ParseVideoId: "util:parseVideoId",

  Player_Event: "player:event",
  Player_Emit: "player:emit"
} as const;