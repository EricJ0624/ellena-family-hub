/**
 * Hearth 멀티 앱 식별자 (Option 2: Supabase 1프로젝트 · 계정 공유 · app_id로 앱 격리)
 *
 * 배포별: NEXT_PUBLIC_APP_ID=hearth_family | hearth_couple | hearth_biker | hearth_camper
 * 미설정 시 Family.
 */

export const APP_IDS = {
  FAMILY: 'hearth_family',
  COUPLE: 'hearth_couple',
  BIKER: 'hearth_biker',
  CAMPER: 'hearth_camper',
} as const;

export type AppId = (typeof APP_IDS)[keyof typeof APP_IDS];

/** 제품 표시명 (브랜드 카피용) */
export const APP_PRODUCT_NAMES: Record<AppId, string> = {
  hearth_family: 'Hearth Family',
  hearth_couple: 'Hearth Couple',
  hearth_biker: 'Hearth Biker',
  hearth_camper: 'Hearth Camper',
};

/**
 * 앱 타이틀 워딩 — 원래 `Hearth: Family Haven` 자리·문장 구조 유지, Haven만 제거.
 * 글자 스타일/사이즈는 기존 UI 그대로(문자열만 교체).
 */
export const APP_TITLE_WORDING: Record<AppId, string> = {
  hearth_family: 'Hearth: Family',
  hearth_couple: 'Hearth: Couple',
  hearth_biker: 'Hearth: Biker',
  hearth_camper: 'Hearth: Camper',
};

/** 로그인 하단 영문 태그라인 패턴 (앱별) */
export const APP_TAGLINE_EN: Record<AppId, string> = {
  hearth_family: 'A space for our family',
  hearth_couple: 'A space for our couple',
  hearth_biker: 'A space for our biker',
  hearth_camper: 'A space for our camper',
};

const APP_ID_SET = new Set<string>(Object.values(APP_IDS));

export function isAppId(value: unknown): value is AppId {
  return typeof value === 'string' && APP_ID_SET.has(value);
}

/** RLS / CHECK 제약과 동일한 허용 목록 */
export const ALLOWED_APP_IDS: readonly AppId[] = [
  APP_IDS.FAMILY,
  APP_IDS.COUPLE,
  APP_IDS.BIKER,
  APP_IDS.CAMPER,
];

/** 이 배포(빌드)가 속한 앱. 서버는 APP_ID 우선, 클라는 NEXT_PUBLIC 우선. 미설정 시 Family. */
export const CURRENT_APP_ID: AppId = (() => {
  const serverFirst =
    typeof window === 'undefined'
      ? process.env.APP_ID?.trim() || process.env.NEXT_PUBLIC_APP_ID?.trim()
      : process.env.NEXT_PUBLIC_APP_ID?.trim() || process.env.APP_ID?.trim();
  const fromEnv = serverFirst || APP_IDS.FAMILY;
  return isAppId(fromEnv) ? fromEnv : APP_IDS.FAMILY;
})();
