import { dialog, BrowserWindow } from "electron";
import fs from "node:fs/promises";
import { FileDialogPort } from "../../../core/application/ports/FileDialogPort";

export class ElectronFileDialog implements FileDialogPort {
  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  async pickExportPath(defaultName: string): Promise<string | null> {
    const win = this.getWindow();
    if (!win) return null;

    const res = await dialog.showSaveDialog(win, {
      title: "Export playlist",
      defaultPath: defaultName,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (res.canceled || !res.filePath) return null;
    return res.filePath;
  }

  async pickImportFile(): Promise<string | null> {
    const win = this.getWindow();
    if (!win) return null;

    const res = await dialog.showOpenDialog(win, {
      title: "Import playlist",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0];
  }

  async readTextFile(path: string): Promise<string> {
    return fs.readFile(path, "utf-8");
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    await fs.writeFile(path, content, "utf-8");
  }
}
