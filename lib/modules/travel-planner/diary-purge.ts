/** mood_tags sentinel: 다이어리 전체삭제(복구 불가). 플래너 일정은 유지. */
export const DIARY_PURGE_TAG = '__diary_purge__';

export function isDiaryPurgedEntry(entry: { mood_tags?: string[] | null } | null | undefined): boolean {
  return Array.isArray(entry?.mood_tags) && entry!.mood_tags!.includes(DIARY_PURGE_TAG);
}
