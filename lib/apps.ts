/**
 * Hearth 멀티 앱 식별자 (Option 2: Supabase 1프로젝트 · 계정 공유 · app_id로 앱 격리)
 *
 * 배포별: NEXT_PUBLIC_APP_ID=hearth_family | hearth_couple | hearth_biker | hearth_camper
 * 미설정 시 Family.
 *
 * 앱별 표시 문구(타이틀·태그라인)는 lib/translations/* 의 i18n 키를 사용한다.
 */

export const APP_IDS = {
  FAMILY: 'hearth_family',
  COUPLE: 'hearth_couple',
  BIKER: 'hearth_biker',
  CAMPER: 'hearth_camper',
} as const;

export type AppId = (typeof APP_IDS)[keyof typeof APP_IDS];

export const ALL_APP_IDS: AppId[] = Object.values(APP_IDS);

/** 시스템 관리자 콘솔 등에서 쓰는 짧은 앱 표시명 */
export const APP_ID_LABELS: Record<AppId, string> = {
  hearth_family: 'Family',
  hearth_couple: 'Couple',
  hearth_biker: 'Biker',
  hearth_camper: 'Camper',
};

export function getAppIdLabel(appId: string | null | undefined): string {
  if (appId && isAppId(appId)) return APP_ID_LABELS[appId];
  return appId || '-';
}

/** 관리자 콘솔 앱 뱃지 Tailwind 클래스 */
export const APP_ID_BADGE_CLASS: Record<AppId, string> = {
  hearth_family: 'bg-sky-100 text-sky-800',
  hearth_couple: 'bg-rose-100 text-rose-800',
  hearth_biker: 'bg-amber-100 text-amber-900',
  hearth_camper: 'bg-emerald-100 text-emerald-800',
};

export function getAppIdBadgeClass(appId: string | null | undefined): string {
  if (appId && isAppId(appId)) return APP_ID_BADGE_CLASS[appId];
  return 'bg-slate-100 text-slate-700';
}

const APP_ID_SET = new Set<string>(Object.values(APP_IDS));

export function isAppId(value: unknown): value is AppId {
  return typeof value === 'string' && APP_ID_SET.has(value);
}

/** 이 배포(빌드)가 속한 앱. 서버는 APP_ID 우선, 클라는 NEXT_PUBLIC 우선. 미설정 시 Family. */
export const CURRENT_APP_ID: AppId = (() => {
  const serverFirst =
    typeof window === 'undefined'
      ? process.env.APP_ID?.trim() || process.env.NEXT_PUBLIC_APP_ID?.trim()
      : process.env.NEXT_PUBLIC_APP_ID?.trim() || process.env.APP_ID?.trim();
  const fromEnv = serverFirst || APP_IDS.FAMILY;
  return isAppId(fromEnv) ? fromEnv : APP_IDS.FAMILY;
})();
