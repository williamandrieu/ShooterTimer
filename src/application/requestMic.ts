import { AppErrorCode, appError } from '../domain/errors.ts';
import { err, ok, type Result } from '../domain/result.ts';
import { normalizeMicPermissionState, type MicPermissionState } from '../domain/settings/settings.ts';

export async function requestMicrophone(
  request: () => Promise<MediaStream>,
): Promise<Result<void>> {
  try {
    const stream = await request();
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return ok(undefined);
  } catch (cause) {
    return err(appError(AppErrorCode.MIC_DENIED, 'Microphone permission denied', cause));
  }
}

export async function queryMicrophonePermission(
  query: () => Promise<string>,
): Promise<MicPermissionState> {
  try {
    return normalizeMicPermissionState(await query());
  } catch {
    return 'unknown';
  }
}
