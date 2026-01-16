import { autoUpdater } from "electron-updater";
import { BrowserWindow, dialog } from "electron";
import { LoggerPort } from "../../../core/application/ports/LoggerPort";

/**
 * Auto Updater Adapter
 * Handles automatic application updates using electron-updater
 */
export class AutoUpdaterAdapter {
  constructor(
    private readonly logger: LoggerPort,
    private readonly getWindow: () => BrowserWindow | null
  ) {
    this.setupEventHandlers();
  }

  private log(message: string, ...args: any[]): void {
    if (this.logger.log) {
      this.logger.log(message, ...args);
    } else {
      this.logger.info(message);
    }
  }

  private setupEventHandlers(): void {
    // Check for updates on start (after 3 seconds delay)
    autoUpdater.logger = this.logger;

    autoUpdater.on("checking-for-update", () => {
      this.log("🔍 Verificando actualizaciones...");
    });

    autoUpdater.on("update-available", (info) => {
      this.log("✅ Actualización disponible:", info);
      const window = this.getWindow();
      if (window) {
        dialog.showMessageBox(window, {
          type: "info",
          title: "Actualización disponible",
          message: `Hay una nueva versión disponible (${info.version}). Se descargará en segundo plano.`,
          buttons: ["OK"],
        });
      }
    });

    autoUpdater.on("update-not-available", (info) => {
      this.log("ℹ️ No hay actualizaciones disponibles");
    });

    autoUpdater.on("error", (err) => {
      this.logger.error("❌ Error en actualización:", { error: err.message });
    });

    autoUpdater.on("download-progress", (progressObj) => {
      const logMessage = `Descargando: ${progressObj.percent.toFixed(2)}%`;
      this.log(logMessage);
    });

    autoUpdater.on("update-downloaded", (info) => {
      this.log("✅ Actualización descargada");
      const window = this.getWindow();
      if (window) {
        dialog
          .showMessageBox(window, {
            type: "info",
            title: "Actualización lista",
            message:
              "La actualización se ha descargado. La aplicación se reiniciará para instalarla.",
            buttons: ["Reiniciar ahora", "Más tarde"],
            defaultId: 0,
            cancelId: 1,
          })
          .then((result) => {
            if (result.response === 0) {
              autoUpdater.quitAndInstall();
            }
          });
      }
    });
  }

  /**
   * Check for updates manually
   */
  checkForUpdates(): void {
    this.log("Verificando actualizaciones manualmente...");
    autoUpdater.checkForUpdatesAndNotify();
  }

  /**
   * Check for updates on startup (with delay)
   */
  checkForUpdatesOnStartup(delayMs: number = 5000): void {
    setTimeout(() => {
      if (process.env.NODE_ENV !== "development") {
        this.log("Verificando actualizaciones al inicio...");
        autoUpdater.checkForUpdatesAndNotify();
      } else {
        this.log("Modo desarrollo: actualizaciones deshabilitadas");
      }
    }, delayMs);
  }
}
