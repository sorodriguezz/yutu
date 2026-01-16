import { LoggerPort } from "../../../core/application/ports/LoggerPort";

export class ConsoleLogger implements LoggerPort {
  log(msg: string, ...args: any[]) {
    console.log(msg, ...args);
  }
  info(msg: string, meta?: Record<string, unknown>) {
    console.log(`[INFO] ${msg}`, meta ?? "");
  }
  warn(msg: string, meta?: Record<string, unknown>) {
    console.warn(`[WARN] ${msg}`, meta ?? "");
  }
  error(msg: string, meta?: Record<string, unknown>) {
    console.error(`[ERROR] ${msg}`, meta ?? "");
  }
}
