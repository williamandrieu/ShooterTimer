import type { RandomPort } from '../../ports/contracts.ts';

export const browserRandom: RandomPort = {
  next(): number {
    return Math.random();
  },
  between(min: number, max: number): number {
    if (max <= min) {
      return min;
    }
    return min + Math.random() * (max - min);
  },
};

export const browserIds = {
  next(): string {
    return crypto.randomUUID();
  },
};
