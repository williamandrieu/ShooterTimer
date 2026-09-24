export const AppErrorCode = {
  MIC_DENIED: 'MIC_DENIED',
  WORKLET_FAILED: 'WORKLET_FAILED',
  IDB_READ: 'IDB_READ',
  IDB_WRITE: 'IDB_WRITE',
  INVALID_RUN_CONFIG: 'INVALID_RUN_CONFIG',
  NO_PAR_WINDOW: 'NO_PAR_WINDOW',
  DRILL_NOT_FOUND: 'DRILL_NOT_FOUND',
  INVALID_SETTINGS: 'INVALID_SETTINGS',
  INVALID_SESSION: 'INVALID_SESSION',
  AUDIO_CONTEXT_FAILED: 'AUDIO_CONTEXT_FAILED',
  WAKE_LOCK_FAILED: 'WAKE_LOCK_FAILED',
  START_DISPOSED: 'START_DISPOSED',
  START_SKIPPED: 'START_SKIPPED',
} as const;

export type AppErrorCode = (typeof AppErrorCode)[keyof typeof AppErrorCode];

export type AppError = {
  code: AppErrorCode;
  message: string;
  cause?: unknown;
};

export function appError(code: AppErrorCode, message: string, cause?: unknown): AppError {
  if (cause === undefined) {
    return { code, message };
  }
  return { code, message, cause };
}
