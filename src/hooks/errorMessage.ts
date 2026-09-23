import { AppErrorCode } from '../domain/errors.ts';
import type { TranslationKey } from '../i18n/index.ts';

export function errorMessageKey(code: string): TranslationKey {
  if (code === AppErrorCode.MIC_DENIED) {
    return 'error.mic';
  }
  if (code === AppErrorCode.NO_PAR_WINDOW) {
    return 'error.noPar';
  }
  if (code === AppErrorCode.INVALID_RUN_CONFIG) {
    return 'error.invalidRun';
  }
  return 'error.generic';
}
