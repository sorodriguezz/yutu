import { Tray, Menu, nativeImage, BrowserWindow, app } from "electron";
import path from "node:path";
import { AppContainer } from "../../di/container";

/**
 * Tray Icon Adapter
 * Creates system tray icon with context menu and playback controls
 */
export class TrayIconAdapter {
  private tray: Tray | null = null;

  constructor(
    private readonly container: AppContainer,
    private readonly getWindow: () => BrowserWindow | null
  ) {}

  create(): void {
    if (this.tray) {
      console.warn("Tray icon already exists");
      return;
    }

    try {
      // Create a simple icon (you should replace this with an actual icon file)
      // For now, we'll use a simple placeholder
      const icon = nativeImage.createFromDataURL(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAIkSURBVFhH7ZbLSwJRFMav+AjMLBJ6QBFBm6KgoCC0hYhcREtbRLRo1aZ/oFX/QKugVYtaNhQRQQRBi6CgCKKgIIigIAh6kJWW3c453plxHDN3xtLF0AcfM+fec76558ydO1cI/1NKpVKdUqn0pFQq3SuVykxJkqYURZmXJGlKVdVxVVXHNE0bk2V5VJKUT1VVx1RVHdM07VPTNFVV1U9N0z6VSqUHRVGWFEVZliTpQ5Kk91Kp9CbL8oskSS+KorxKkvQsivJMLBafBUF4chznURCER0EQHgRBeOB5/p7n+Tuu1+u1Wq3X6nX63v49z/P3PM/fcT1/x3Ec1+v1eq1Wq9frdaPRaDQajUaj0Wj8b/V6vV6r1Wq1Wq1er9fr9Xq9Xq/X6/V6vV6v1+v1er1er9fr9Xq9Xq/X6/V6vV6v1+v1er3+/9Xv9/u9Xq/Xa7VarVarVavVqtVq1Wq1arVatVqtWq1WrVar1Wq1arVatVqtWq1WrVar1Wq1arVa/1O73W53Op1Op9PpdDqdTqfT6XQ6nU6n0+l0Op1Op9PpdDqdTqfT6XQ6nU6n0+l0Op1O/9/a7Xa73W63Ox232+12u91ut9vtdrvdbrfb7Xa73W63Ox232+12u91ut9vtdrvdbrfb/1Pb7Xa73W632+12u91ut9vtdrvdbrfb7Xa73W632+12u91ut9vtdrvdbrfb7Xa73W632+12u93+n9put9vtdrvdbrfb7Xa73W632+12u91ut9vtdvuf9QMwL0FO8LGYUQAAAABJRU5ErkJggg=="
      );

      this.tray = new Tray(icon);

      this.updateContextMenu();

      this.tray.setToolTip("YT Local Player");

      // Double click to show/hide window
      this.tray.on("double-click", () => {
        const window = this.getWindow();
        if (window) {
          if (window.isVisible()) {
            window.hide();
          } else {
            window.show();
          }
        }
      });

      console.log("✅ Tray icon created successfully");
    } catch (error) {
      console.error("Error creating tray icon:", error);
    }
  }

  updateContextMenu(currentTrack?: { title?: string; author?: string }): void {
    if (!this.tray) return;

    const queueState = this.container.queue.getState();
    const currentItem = queueState.queue[queueState.index];

    const trackInfo = currentItem?.title
      ? `🎵 ${currentItem.title}`
      : "No hay canción reproduciéndose";

    const contextMenu = Menu.buildFromTemplate([
      {
        label: trackInfo,
        enabled: false,
      },
      { type: "separator" },
      {
        label: "⏮️ Anterior",
        click: async () => {
          await this.container.uc.playback.prev.execute();
        },
      },
      {
        label: "⏯️ Play/Pause",
        click: async () => {
          // Toggle play/pause
          await this.container.player.play();
        },
      },
      {
        label: "⏭️ Siguiente",
        click: async () => {
          await this.container.uc.playback.next.execute();
        },
      },
      { type: "separator" },
      {
        label: queueState.shuffle ? "🔀 Aleatorio: Activado" : "🔀 Aleatorio: Desactivado",
        click: async () => {
          await this.container.uc.playback.toggleShuffle.execute();
          this.updateContextMenu();
        },
      },
      {
        label: `🔁 Repetir: ${queueState.repeat === "off" ? "Desactivado" : queueState.repeat === "all" ? "Todo" : "Una"}`,
        click: async () => {
          await this.container.uc.playback.cycleRepeat.execute();
          this.updateContextMenu();
        },
      },
      { type: "separator" },
      {
        label: "Mostrar/Ocultar",
        click: () => {
          const window = this.getWindow();
          if (window) {
            if (window.isVisible()) {
              window.hide();
            } else {
              window.show();
            }
          }
        },
      },
      {
        label: "Salir",
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      console.log("Tray icon destroyed");
    }
  }
}
