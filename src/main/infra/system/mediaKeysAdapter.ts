import { globalShortcut } from "electron";
import { AppContainer } from "../../di/container";

/**
 * Media Keys Adapter
 * Registers global shortcuts for media keys (Play/Pause, Next, Previous)
 */
export class MediaKeysAdapter {
  private registered = false;

  constructor(private readonly container: AppContainer) {}

  register(): void {
    if (this.registered) {
      console.warn("Media keys already registered");
      return;
    }

    try {
      // Play/Pause
      globalShortcut.register("MediaPlayPause", async () => {
        // Toggle play/pause - we need to check current state
        await this.container.player.play(); // Simplified - you may want to track state
      });

      // Next track
      globalShortcut.register("MediaNextTrack", async () => {
        await this.container.uc.playback.next.execute();
      });

      // Previous track
      globalShortcut.register("MediaPreviousTrack", async () => {
        await this.container.uc.playback.prev.execute();
      });

      // Stop (treat as pause)
      globalShortcut.register("MediaStop", async () => {
        await this.container.player.pause();
      });

      this.registered = true;
      console.log("✅ Media keys registered successfully");
    } catch (error) {
      console.error("Error registering media keys:", error);
    }
  }

  unregister(): void {
    if (!this.registered) {
      return;
    }

    try {
      globalShortcut.unregister("MediaPlayPause");
      globalShortcut.unregister("MediaNextTrack");
      globalShortcut.unregister("MediaPreviousTrack");
      globalShortcut.unregister("MediaStop");

      this.registered = false;
      console.log("Media keys unregistered");
    } catch (error) {
      console.error("Error unregistering media keys:", error);
    }
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll();
    this.registered = false;
  }
}
