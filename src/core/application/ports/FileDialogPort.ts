export interface FileDialogPort {
  pickExportPath(defaultName: string): Promise<string | null>;
  pickImportFile(): Promise<string | null>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
}
