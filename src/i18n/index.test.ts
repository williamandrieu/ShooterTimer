import { describe, expect, it } from 'vitest';
import { catalogKeys, detectLocale, formatTime, isKey, missingKeys, pickMessages, t } from './index.ts';
import { en } from './en.ts';
import { fr } from './fr.ts';
import { pl } from './pl.ts';

describe('i18n', () => {
  it('keeps catalogs aligned and formats time', () => {
    const keys = catalogKeys();
    expect(Object.keys(fr).sort()).toEqual([...keys].sort());
    expect(Object.keys(pl).sort()).toEqual([...keys].sort());
    expect(missingKeys('fr')).toEqual([]);
    expect(t(en, 'run.start')).toBe('Start');
    expect(t(en, 'run.start', { x: '1' })).toBe('Start');
    expect(t(en, 'missing-key')).toBe('missing-key');
    expect(t(en, 'app.name', { unused: undefined as unknown as string })).toBe(en['app.name']);
    expect(formatTime(1.2, 'fr')).toContain('1');
    expect(isKey('run.start')).toBe(true);
    expect(isKey('nope')).toBe(false);
    expect(pickMessages('pl')['nav.history']).toBe(pl['nav.history']);
    const previous = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'pl-PL' } });
    expect(detectLocale()).toBe('pl');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: undefined });
    expect(detectLocale()).toBe('en');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: previous });
  });
});
