import { timeSec, type TimeSec } from '../../domain/value-objects/ids.ts';
import type { ClockPort } from '../../ports/contracts.ts';

export const browserClock: ClockPort = {
  now(): TimeSec {
    return timeSec(performance.now() / 1000);
  },
  wallMs(): number {
    return Date.now();
  },
  setTimeout(fn: () => void, ms: number): number {
    return window.setTimeout(fn, ms);
  },
  clearTimeout(id: number): void {
    window.clearTimeout(id);
  },
  setInterval(fn: () => void, ms: number): number {
    return window.setInterval(fn, ms);
  },
  clearInterval(id: number): void {
    window.clearInterval(id);
  },
};
