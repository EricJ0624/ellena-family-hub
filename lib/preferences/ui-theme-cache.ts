import { normalizeGroupId } from '@/lib/validation';
import { isExplicitUiTheme, resolveUiTheme, type UiTheme } from '@/lib/ui-theme';

const STORAGE_KEY_PREFIX = 'hearth.uiTheme.v1';

function normalizeUserId(userId: string | null | undefined): string | null {
  const t = typeof userId === 'string' ? userId.trim() : '';
  return t || null;
}

function userThemeKey(
  userId: string | null | undefined,
  groupId: string | null | undefined,
): string | null {
  const uid = normalizeUserId(userId);
  const gid = normalizeGroupId(groupId);
  if (!uid || !gid) return null;
  return `${STORAGE_KEY_PREFIX}:${uid}:${gid}`;
}

function groupThemeKey(groupId: string | null | undefined): string | null {
  const gid = normalizeGroupId(groupId);
  if (!gid) return null;
  return `${STORAGE_KEY_PREFIX}:group:${gid}`;
}

/**
 * 마지막 확인 ui_theme.
 * userId+groupId 우선, 없으면 groupId만으로 폴백 (auth paint 전 선적용용).
 */
export function readStoredUiTheme(
  userId: string | null | undefined,
  groupId: string | null | undefined,
): UiTheme | null {
  if (typeof window === 'undefined') return null;
  try {
    const userKey = userThemeKey(userId, groupId);
    if (userKey) {
      const raw = localStorage.getItem(userKey);
      if (isExplicitUiTheme(raw)) return resolveUiTheme(raw);
    }
    const gKey = groupThemeKey(groupId);
    if (gKey) {
      const raw = localStorage.getItem(gKey);
      if (isExplicitUiTheme(raw)) return resolveUiTheme(raw);
    }
    return null;
  } catch {
    return null;
  }
}

/** user 키 + group 키 모두 기록 (group 키는 userId 없이도 선적용 가능) */
export function writeStoredUiTheme(
  userId: string | null | undefined,
  groupId: string | null | undefined,
  theme: UiTheme,
): void {
  if (typeof window === 'undefined') return;
  const resolved = resolveUiTheme(theme);
  try {
    const userKey = userThemeKey(userId, groupId);
    if (userKey) localStorage.setItem(userKey, resolved);
    const gKey = groupThemeKey(groupId);
    if (gKey) localStorage.setItem(gKey, resolved);
  } catch {
    // quota / private mode
  }
}
