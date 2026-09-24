import type { Result } from '../domain/result.ts';
import { computeReviewStats } from '../domain/review/stats.ts';
import type { Session } from '../domain/session/session.ts';
import { firstShotTime, lastShotTime } from '../domain/session/session.ts';
import type { Settings } from '../domain/settings/settings.ts';
import type { TimerState } from '../domain/timer/state.ts';
import type { IdPort, SessionRepository } from '../ports/contracts.ts';

export function timerStateToSession(
  state: TimerState,
  ids: IdPort,
  createdAt: number,
  settings: Settings,
): Session {
  return {
    id: ids.next(),
    createdAt,
    drillId: state.drillId,
    timerProfile: state.profile,
    inputMethod: state.inputMethod,
    shots: state.shots,
    firstShotSec: firstShotTime(state.shots),
    totalSec: lastShotTime(state.shots) ?? state.elapsedSec,
    settingsSnapshot: { sensitivity: settings.micSensitivity, preset: settings.micPreset },
  };
}

export async function saveSession(
  repository: SessionRepository,
  session: Session,
): Promise<Result<void>> {
  return repository.save(session);
}

export async function listSessions(repository: SessionRepository): Promise<Result<Session[]>> {
  return repository.list();
}

export async function deleteSession(
  repository: SessionRepository,
  id: string,
): Promise<Result<void>> {
  return repository.delete(id);
}

export async function getSession(
  repository: SessionRepository,
  id: string,
): Promise<Result<Session | null>> {
  return repository.get(id);
}

export { computeReviewStats };
