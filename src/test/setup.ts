import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

if (!navigator.mediaDevices) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(),
    },
  });
}

if (!navigator.vibrate) {
  Object.defineProperty(navigator, 'vibrate', {
    configurable: true,
    value: vi.fn(),
  });
}
