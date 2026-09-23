import { describe, expect, it } from 'vitest';
import { catalogKeys } from './index.ts';
import { en } from './en.ts';
import { fr } from './fr.ts';
import { pl } from './pl.ts';
import { allTitleAndBriefKeys } from '../domain/drills/catalog.ts';

describe('i18n keys', () => {
  it('has the same keys in fr, en, pl including drills', () => {
    const keys = catalogKeys().sort();
    expect(Object.keys(en).sort()).toEqual(keys);
    expect(Object.keys(fr).sort()).toEqual(keys);
    expect(Object.keys(pl).sort()).toEqual(keys);
    for (const key of allTitleAndBriefKeys()) {
      expect(keys).toContain(key);
    }
  });
});
