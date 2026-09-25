import { describe, expect, it } from 'vitest';
import { DRILLS, ISSF_START_DELAY_SEC, allTitleAndBriefKeys, drillsByCategory, getDrill } from './catalog.ts';
import { DrillDefinitionSchema } from '../../validation/schemas.ts';

describe('drill catalog', () => {
  it('has unique ids, valid schemas and lookup helpers', () => {
    const ids = DRILLS.map((drill) => drill.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const drill of DRILLS) {
      expect(DrillDefinitionSchema.safeParse(drill).success).toBe(true);
    }
    expect(getDrill('bill-drill-6')?.expectedShots).toBe(6);
    expect(getDrill('missing')).toBeUndefined();
    expect(drillsByCategory('ipsc').every((drill) => drill.category === 'ipsc')).toBe(true);
    expect(drillsByCategory('issf').every((drill) => drill.prepSeconds === ISSF_START_DELAY_SEC)).toBe(true);
    expect(allTitleAndBriefKeys().length).toBe(DRILLS.length * 2);
    expect(getDrill('draw')?.recommendedInput).not.toContain('dryPar');
    expect(getDrill('custom-par')?.recommendedInput).toEqual(['live', 'dryTap']);
    expect(getDrill('fftir-3-7')?.exposures).toEqual({ count: 5, windowSec: 3, pauseSec: 7 });
    expect(getDrill('fftir-3-7')?.prepSeconds).toBe(ISSF_START_DELAY_SEC);
  });
});
