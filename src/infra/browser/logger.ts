import type { Logger } from '../../ports/contracts.ts';

export const consoleLogger: Logger = {
  debug(message: string, extra?: unknown): void {
    console.debug(message, extra);
  },
  warn(message: string, extra?: unknown): void {
    console.warn(message, extra);
  },
  error(message: string, extra?: unknown): void {
    console.error(message, extra);
  },
};
