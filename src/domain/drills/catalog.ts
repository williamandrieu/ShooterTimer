import type { Drill } from './types.ts';
import { drillId } from '../value-objects/ids.ts';

export const DRILLS: readonly Drill[] = [
  {
    id: drillId('free-timer'),
    category: 'ipsc',
    timerProfile: 'ipscRandomStart',
    expectedShots: null,
    recommendedInput: ['live', 'dryTap'],
    titleKey: 'drill.free.title',
    briefKey: 'drill.free.brief',
  },
  {
    id: drillId('draw'),
    category: 'ipsc',
    timerProfile: 'ipscRandomStart',
    expectedShots: 1,
    recommendedInput: ['live', 'dryTap'],
    titleKey: 'drill.draw.title',
    briefKey: 'drill.draw.brief',
  },
  {
    id: drillId('controlled-pair'),
    category: 'ipsc',
    timerProfile: 'ipscRandomStart',
    expectedShots: 2,
    recommendedInput: ['live', 'dryTap'],
    titleKey: 'drill.pair.title',
    briefKey: 'drill.pair.brief',
  },
  {
    id: drillId('bill-drill-6'),
    category: 'ipsc',
    timerProfile: 'ipscRandomStart',
    expectedShots: 6,
    recommendedInput: ['live', 'dryTap'],
    titleKey: 'drill.bill.title',
    briefKey: 'drill.bill.brief',
  },
  {
    id: drillId('mozambique'),
    category: 'ipsc',
    timerProfile: 'ipscRandomStart',
    expectedShots: 3,
    recommendedInput: ['live', 'dryTap'],
    titleKey: 'drill.mozambique.title',
    briefKey: 'drill.mozambique.brief',
  },
  {
    id: drillId('el-presidente'),
    category: 'ipsc',
    timerProfile: 'ipscRandomStart',
    expectedShots: 12,
    recommendedInput: ['live', 'dryTap'],
    titleKey: 'drill.elpres.title',
    briefKey: 'drill.elpres.brief',
  },
  {
    id: drillId('custom-par'),
    category: 'ipsc',
    timerProfile: 'ipscRandomStart',
    expectedShots: null,
    parSeconds: 5,
    recommendedInput: ['live', 'dryPar', 'dryTap'],
    titleKey: 'drill.customPar.title',
    briefKey: 'drill.customPar.brief',
  },
  {
    id: drillId('std-pistol-150'),
    category: 'issf',
    timerProfile: 'issfParCountdown',
    expectedShots: 5,
    parSeconds: 150,
    prepSeconds: 60,
    recommendedInput: ['live', 'dryPar', 'dryTap'],
    titleKey: 'drill.std150.title',
    briefKey: 'drill.std150.brief',
  },
  {
    id: drillId('std-pistol-20'),
    category: 'issf',
    timerProfile: 'issfParCountdown',
    expectedShots: 5,
    parSeconds: 20,
    prepSeconds: 60,
    recommendedInput: ['live', 'dryPar', 'dryTap'],
    titleKey: 'drill.std20.title',
    briefKey: 'drill.std20.brief',
  },
  {
    id: drillId('std-pistol-10'),
    category: 'issf',
    timerProfile: 'issfParCountdown',
    expectedShots: 5,
    parSeconds: 10,
    prepSeconds: 60,
    recommendedInput: ['live', 'dryPar', 'dryTap'],
    titleKey: 'drill.std10.title',
    briefKey: 'drill.std10.brief',
  },
  {
    id: drillId('sport-precision-5min'),
    category: 'issf',
    timerProfile: 'issfParCountdown',
    expectedShots: 5,
    parSeconds: 300,
    recommendedInput: ['live', 'dryPar', 'dryTap'],
    titleKey: 'drill.sportPrec.title',
    briefKey: 'drill.sportPrec.brief',
  },
  {
    id: drillId('sport-rapid-3x5'),
    category: 'issf',
    timerProfile: 'issfExposureSequence',
    expectedShots: 5,
    exposures: { count: 5, windowSec: 3, pauseSec: 1 },
    recommendedInput: ['live', 'dryPar', 'dryTap'],
    titleKey: 'drill.sportRapid.title',
    briefKey: 'drill.sportRapid.brief',
  },
  {
    id: drillId('rfp-8'),
    category: 'issf',
    timerProfile: 'issfParCountdown',
    expectedShots: 5,
    parSeconds: 8,
    recommendedInput: ['live', 'dryPar', 'dryTap'],
    titleKey: 'drill.rfp8.title',
    briefKey: 'drill.rfp8.brief',
  },
  {
    id: drillId('rfp-6'),
    category: 'issf',
    timerProfile: 'issfParCountdown',
    expectedShots: 5,
    parSeconds: 6,
    recommendedInput: ['live', 'dryPar', 'dryTap'],
    titleKey: 'drill.rfp6.title',
    briefKey: 'drill.rfp6.brief',
  },
  {
    id: drillId('rfp-4'),
    category: 'issf',
    timerProfile: 'issfParCountdown',
    expectedShots: 5,
    parSeconds: 4,
    recommendedInput: ['live', 'dryPar', 'dryTap'],
    titleKey: 'drill.rfp4.title',
    briefKey: 'drill.rfp4.brief',
  },
];

export function offersDryPar(drill: Drill): boolean {
  return (
    drill.recommendedInput.includes('dryPar') &&
    (drill.parSeconds !== undefined || drill.exposures !== undefined)
  );
}

export function getDrill(id: string): Drill | undefined {
  return DRILLS.find((drill) => drill.id === id);
}

export function drillsByCategory(category: Drill['category']): Drill[] {
  return DRILLS.filter((drill) => drill.category === category);
}

export function allTitleAndBriefKeys(): string[] {
  return DRILLS.flatMap((drill) => [drill.titleKey, drill.briefKey]);
}
