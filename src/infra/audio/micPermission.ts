import { normalizeMicPermissionState, type MicPermissionState } from '../../domain/settings/settings.ts';

type PermissionsQuery = {
  query(desc: { name: string }): Promise<{ state: string }>;
};

export async function queryBrowserMicPermission(
  permissions?: PermissionsQuery,
): Promise<MicPermissionState> {
  const api =
    permissions ??
    (typeof navigator === 'undefined' ? undefined : (navigator.permissions as PermissionsQuery | undefined));
  if (!api?.query) {
    return 'unknown';
  }
  try {
    const status = await api.query({ name: 'microphone' });
    return normalizeMicPermissionState(status.state);
  } catch {
    return 'unknown';
  }
}
