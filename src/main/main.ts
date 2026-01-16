import { app, BrowserWindow, WebContentsView, session, protocol, ipcMain } from "electron";
import path from "node:path";
import http from "node:http";
import fs from "node:fs";
import { buildContainer } from "./di/container";
import { registerIpc } from "./ipc/registerIpc";

let mainWindow: BrowserWindow | null = null;
let playerView: WebContentsView | null = null;
let httpServer: http.Server | null = null;
let videoVisible = false; // Start with video visible so it can play

// Create simple HTTP server for player
function createPlayerServer() {
  const port = 3456;
  httpServer = http.createServer((req, res) => {
    let filePath = path.join(__dirname, '..', 'player', req.url === '/' ? 'player-http.html' : req.url || '');
    
    if (req.url?.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (req.url?.endsWith('.html')) {
      res.setHeader('Content-Security-Policy', "default-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://i.ytimg.com https://s.ytimg.com 'unsafe-inline' 'unsafe-eval'; frame-src https://www.youtube.com https://www.youtube-nocookie.com;");
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
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

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
  // Ensure HTTP server is closed
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
});