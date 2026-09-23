import { z } from 'zod';
import { AppErrorCode, appError } from '../domain/errors.ts';
import { err, ok, type Result } from '../domain/result.ts';
import type { Drill, InputMethod, RunConfig } from '../domain/drills/types.ts';
import { drillId } from '../domain/value-objects/ids.ts';
import type { Locale, MicPreset, Settings } from '../domain/settings/settings.ts';
import { DEFAULT_SETTINGS, LOCALES, MIC_PRESETS, mergeSettings } from '../domain/settings/settings.ts';
import type { Session, ShotEvent } from '../domain/session/session.ts';
import { shotIndex, splitSec, timeSec } from '../domain/value-objects/ids.ts';

export const InputMethodSchema = z.enum(['live', 'dryPar', 'dryTap', 'dryParTap']);
export const TimerProfileSchema = z.enum(['ipscRandomStart', 'issfParCountdown', 'issfExposureSequence']);
export const LocaleSchema = z.enum(LOCALES as unknown as [Locale, ...Locale[]]);
export const MicPresetSchema = z.enum(MIC_PRESETS as unknown as [MicPreset, ...MicPreset[]]);

export const DrillDefinitionSchema = z.object({
  id: z.string().min(1),
  category: z.enum(['ipsc', 'issf']),
  timerProfile: TimerProfileSchema,
  expectedShots: z.number().int().positive().nullable(),
  parSeconds: z.number().positive().optional(),
  exposures: z
    .object({
      count: z.number().int().positive(),
      windowSec: z.number().positive(),
      pauseSec: z.number().nonnegative(),
    })
    .optional(),
  prepSeconds: z.number().nonnegative().optional(),
  recommendedInput: z.array(z.enum(['live', 'dryPar', 'dryTap'])).min(1),
  titleKey: z.string().min(1),
  briefKey: z.string().min(1),
});

export const RunConfigSchema = z.object({
  drillId: z.string().min(1),
  inputMethod: InputMethodSchema,
  parSecondsOverride: z.number().positive().optional(),
});

export const SettingsSchema = z.object({
  locale: LocaleSchema,
  ipscDelayMinSec: z.number().nonnegative(),
  ipscDelayMaxSec: z.number().nonnegative(),
  beepVolume: z.number().min(0).max(1),
  flashEnabled: z.boolean(),
  vibrationEnabled: z.boolean(),
  micPreset: MicPresetSchema,
  micSensitivity: z.number().min(0).max(1),
  prepEnabled: z.boolean(),
  reducedMotion: z.boolean(),
  micGranted: z.boolean().optional(),
});

export const ShotEventRecordSchema = z.object({
  index: z.number().int().positive(),
  time: z.number().nonnegative(),
  split: z.number().nullable(),
  exposureIndex: z.number().int().nonnegative().optional(),
  inWindow: z.boolean(),
  targetIndex: z.number().int().nonnegative(),
});

export const SessionRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.number(),
  drillId: z.string().min(1),
  timerProfile: TimerProfileSchema,
  inputMethod: InputMethodSchema,
  shots: z.array(ShotEventRecordSchema),
  firstShotSec: z.number().nonnegative().nullable(),
  totalSec: z.number().nonnegative().nullable(),
  settingsSnapshot: z.object({
    sensitivity: z.number(),
    preset: MicPresetSchema,
  }),
  shooterName: z.string().optional(),
});

export type SessionRecord = z.infer<typeof SessionRecordSchema>;

export function parseRunSearchParams(search: string): Result<RunConfig> {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const par = params.get('par');
  const parsed = RunConfigSchema.safeParse({
    drillId: params.get('drillId') ?? '',
    inputMethod: params.get('input') ?? '',
    parSecondsOverride: par ? Number(par) : undefined,
  });
  if (!parsed.success) {
    return err(appError(AppErrorCode.INVALID_RUN_CONFIG, 'Invalid run parameters'));
  }
  return ok({
    drillId: drillId(parsed.data.drillId),
    inputMethod: parsed.data.inputMethod,
    parSecondsOverride: parsed.data.parSecondsOverride,
  });
}

export function parseSettings(raw: unknown): Settings {
  const parsed = SettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return DEFAULT_SETTINGS;
  }
  const { min, max } = {
    min: parsed.data.ipscDelayMinSec,
    max: parsed.data.ipscDelayMaxSec < parsed.data.ipscDelayMinSec
      ? parsed.data.ipscDelayMinSec
      : parsed.data.ipscDelayMaxSec,
  };
  return mergeSettings({
    ...parsed.data,
    ipscDelayMinSec: min,
    ipscDelayMaxSec: max,
    micGranted: parsed.data.micGranted ?? false,
  });
}

export function parseSessionRecord(raw: unknown): Result<Session> {
  const parsed = SessionRecordSchema.safeParse(raw);
  if (!parsed.success) {
    return err(appError(AppErrorCode.INVALID_SESSION, 'Invalid session record'));
  }
  return ok(sessionFromRecord(parsed.data));
}

export function sessionToRecord(session: Session): SessionRecord {
  return {
    id: session.id,
    createdAt: session.createdAt,
    drillId: session.drillId,
    timerProfile: session.timerProfile,
    inputMethod: session.inputMethod,
    shots: session.shots.map(shotToRecord),
    firstShotSec: session.firstShotSec,
    totalSec: session.totalSec,
    settingsSnapshot: session.settingsSnapshot,
    shooterName: session.shooterName,
  };
}

export function sessionFromRecord(record: SessionRecord): Session {
  return {
    id: record.id,
    createdAt: record.createdAt,
    drillId: drillId(record.drillId),
    timerProfile: record.timerProfile,
    inputMethod: record.inputMethod,
    shots: record.shots.map(shotFromRecord),
    firstShotSec: record.firstShotSec === null ? null : timeSec(record.firstShotSec),
    totalSec: record.totalSec === null ? null : timeSec(record.totalSec),
    settingsSnapshot: record.settingsSnapshot,
    shooterName: record.shooterName,
  };
}

function shotToRecord(shot: ShotEvent) {
  return {
    index: shot.index,
    time: shot.time,
    split: shot.split,
    exposureIndex: shot.exposureIndex,
    inWindow: shot.inWindow,
    targetIndex: shot.targetIndex,
  };
}

function shotFromRecord(shot: z.infer<typeof ShotEventRecordSchema>): ShotEvent {
  return {
    index: shotIndex(shot.index),
    time: timeSec(shot.time),
    split: shot.split === null ? null : splitSec(shot.split),
    exposureIndex: shot.exposureIndex,
    inWindow: shot.inWindow,
    targetIndex: shot.targetIndex,
  };
}

export function parseDrillDefinition(raw: unknown): Result<Drill> {
  const parsed = DrillDefinitionSchema.safeParse(raw);
  if (!parsed.success) {
    return err(appError(AppErrorCode.INVALID_RUN_CONFIG, 'Invalid drill definition'));
  }
  return ok({
    ...parsed.data,
    id: drillId(parsed.data.id),
  });
}

export function isInputMethod(value: string): value is InputMethod {
  return InputMethodSchema.safeParse(value).success;
}
