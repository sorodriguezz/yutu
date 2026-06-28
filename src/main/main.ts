import { app, BrowserWindow, WebContentsView, session, protocol, ipcMain, net, shell } from "electron";
import path from "node:path";
import http from "node:http";
import fs from "node:fs";
import { buildContainer } from "./di/container";
import { registerIpc } from "./ipc/registerIpc";
import { MediaKeysAdapter } from "./infra/system/mediaKeysAdapter";
import { TrayIconAdapter } from "./infra/system/trayIconAdapter";
import { AutoUpdaterAdapter } from "./infra/system/autoUpdaterAdapter";
import { URL } from "url";

let mainWindow: BrowserWindow | null = null;
let playerView: WebContentsView | null = null;
let httpServer: http.Server | null = null;
let videoVisible = false; // Start with video visible so it can play
let mediaKeys: MediaKeysAdapter | null = null;
let trayIcon: TrayIconAdapter | null = null;
let autoUpdater: AutoUpdaterAdapter | null = null;

// MIME types for local media streaming
const MEDIA_MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wma': 'audio/x-ms-wma',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo'
};

// Stream a local file with HTTP Range support (needed for seeking)
function streamLocalFile(filePath: string, req: http.IncomingMessage, res: http.ServerResponse) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const total = stat.size;
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MEDIA_MIME[ext] || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match && match[1] ? parseInt(match[1], 10) : 0;
      const end = match && match[2] ? parseInt(match[2], 10) : total - 1;
      const safeEnd = Math.min(end, total - 1);
      const chunkSize = safeEnd - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${safeEnd}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });
      fs.createReadStream(filePath, { start, end: safeEnd }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': total,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

// Create simple HTTP server for player + local media streaming
function createPlayerServer() {
  const port = 3456;
  httpServer = http.createServer((req, res) => {
    const reqUrl = req.url || '/';
    const parsed = new URL(reqUrl, `http://localhost:${port}`);

    // Local media streaming endpoint: /media?src=<absolute file path>
    if (parsed.pathname === '/media') {
      const src = parsed.searchParams.get('src');
      if (!src) {
        res.writeHead(400);
        res.end('Missing src');
        return;
      }
      streamLocalFile(decodeURIComponent(src), req, res);
      return;
    }

    const fileName = parsed.pathname === '/' ? 'player-http.html' : parsed.pathname;
    let filePath = path.join(__dirname, '..', 'player', fileName);

    if (fileName.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (fileName.endsWith('.html')) {
      res.setHeader('Content-Security-Policy', "default-src 'self' http://localhost:3456 https://www.youtube.com https://www.youtube-nocookie.com https://i.ytimg.com https://s.ytimg.com 'unsafe-inline' 'unsafe-eval'; frame-src https://www.youtube.com https://www.youtube-nocookie.com; media-src 'self' http://localhost:3456 blob:;");
      res.setHeader('Content-Type', 'text/html');
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200);
      res.end(data);
    });
  });

  httpServer.listen(port);

  return port;
}

function createWindow() {
  // Configurar session para permitir YouTube
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    callback({ requestHeaders: details.requestHeaders });
  });

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  // Abrir SIEMPRE los enlaces externos en el navegador por defecto del PC
  // (nunca dentro de una ventana de la app). Esto también hace que el login
  // de Google no se abra embebido (Google bloquea los webviews).
  const isInternalUrl = (url: string) =>
    url.startsWith("file:") || url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1");

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (!isInternalUrl(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  playerView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, "..", "player", "player-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Necesario para YouTube iframe
      allowRunningInsecureContent: false
    }
  });

  // Configurar user agent para el player
  playerView.webContents.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Permitir todas las solicitudes de permisos (para YouTube)
  playerView.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  // Cualquier ventana emergente del player (p. ej. "ver en YouTube") al navegador del PC
  playerView.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });



  // Add playerView initially so it can load and play
  mainWindow.contentView.addChildView(playerView);

  const resizePlayer = () => {
    if (!mainWindow || !playerView) return;
    const b = mainWindow.getBounds();
    const sidebarW = 280;
    const topBarH = 60;
    const playerBarH = 90;
    const playerH = 300;
    
    if (videoVisible) {
      // Position it at the top, leaving space for the player bar at bottom
      playerView.setBounds({ x: sidebarW, y: topBarH, width: b.width - sidebarW, height: playerH });
    } else {
      // Keep it with valid dimensions but position it below the visible area
      // This allows YouTube API to work even when "hidden"
      playerView.setBounds({ x: sidebarW, y: b.height + 100, width: b.width - sidebarW, height: playerH });
    }
  };

  resizePlayer();
  mainWindow.on("resize", resizePlayer);

  // Handle window close properly
  mainWindow.on("close", (e) => {
    // Clean up player view
    if (playerView && mainWindow) {
      mainWindow.contentView.removeChildView(playerView);
      playerView.webContents.close();
      playerView = null;
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Create HTTP server and wait for it to be ready
  const port = createPlayerServer();
  
  // Give the server a moment to start before loading the player
  setTimeout(() => {
    if (playerView) {
      playerView.webContents.loadURL(`http://localhost:${port}/player-http.html`);
    }
  }, 500);

  const container = buildContainer({
    getWindow: () => mainWindow,
    playerView
  });

  // Register media keys
  mediaKeys = new MediaKeysAdapter(container);
  mediaKeys.register();

  // Create tray icon
  trayIcon = new TrayIconAdapter(container, () => mainWindow);
  trayIcon.create();

  // Setup auto-updater
  autoUpdater = new AutoUpdaterAdapter(container.logger, () => mainWindow);
  autoUpdater.checkForUpdatesOnStartup(5000);

  registerIpc(() => mainWindow, container, () => playerView, () => {
    videoVisible = !videoVisible;
    resizePlayer();
    return videoVisible;
  });
}

app.whenReady().then(() => {
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  // Destroy tray icon
  if (trayIcon) {
    trayIcon.destroy();
    trayIcon = null;
  }
  
  // Unregister media keys
  if (mediaKeys) {
    mediaKeys.unregisterAll();
    mediaKeys = null;
  }
  
  // Close HTTP server
  if (httpServer) {
    httpServer.close(() => {
      console.log('HTTP server closed');
    });
    httpServer = null;
  }
  
  // Quit app on all platforms (including macOS)
  app.quit();
});

app.on("before-quit", () => {
  // Destroy tray icon
  if (trayIcon) {
    trayIcon.destroy();
    trayIcon = null;
  }
  
  // Unregister media keys
  if (mediaKeys) {
    mediaKeys.unregisterAll();
    mediaKeys = null;
  }
  
  // Ensure HTTP server is closed
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
});