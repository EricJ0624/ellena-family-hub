export type DiaryInviteStatus = 'none' | 'pending' | 'accepted' | 'dismissed';

const INVITE_STATUSES = new Set<DiaryInviteStatus>(['none', 'pending', 'accepted', 'dismissed']);

export function normalizeDiaryInviteStatus(raw: string | null | undefined): DiaryInviteStatus {
  const s = String(raw ?? 'none').trim() as DiaryInviteStatus;
  return INVITE_STATUSES.has(s) ? s : 'none';
}

export function isValidDiaryInviteStatus(raw: unknown): raw is DiaryInviteStatus {
  return typeof raw === 'string' && INVITE_STATUSES.has(raw as DiaryInviteStatus);
}

/** Auto transition to completed: invite user unless already answered. */
export function diaryInviteStatusOnCompletedTransition(
  current: string | null | undefined,
): DiaryInviteStatus | null {
  const cur = normalizeDiaryInviteStatus(current);
  if (cur === 'accepted' || cur === 'dismissed') return null;
  return 'pending';
}
