import type { TargetSequencePort } from '../../ports/contracts.ts';

export class SingleWindowTargetSequence implements TargetSequencePort {
  targetCount(): number {
    return 1;
  }

  assignShotToTarget(_shotOrdinal: number): number {
    return 0;
  }
}

export class FiveTargetSequence implements TargetSequencePort {
  targetCount(): number {
    return 5;
  }

  assignShotToTarget(shotOrdinal: number): number {
    if (shotOrdinal < 1) {
      return 0;
    }
    return (shotOrdinal - 1) % 5;
  }
}
