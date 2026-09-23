import { describe, expect, it } from 'vitest';
import { DRILLS, allTitleAndBriefKeys, drillsByCategory, getDrill } from './catalog.ts';
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
    expect(drillsByCategory('issf').length).toBeGreaterThan(0);
    expect(allTitleAndBriefKeys().length).toBe(DRILLS.length * 2);
  });
});
