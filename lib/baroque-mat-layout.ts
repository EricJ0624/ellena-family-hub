/**
 * baroque-gold-landscape.png 매트 동적 텍스트 좌표 (viewBox 970×803).
 * 스크린샷으로 맞출 때는 이 파일만 수정하면 됩니다.
 *
 * PNG에 baked: "FAMILY - GATHERING," (가운데) + "The Collection" (스크립트, 오른쪽)
 * 코드 overlay: [이름] + [연도] — 연도는 GATHERING, 쉼표 직후
 */
export const BAROQUE_MAT_LAYOUT = {
  viewBox: { width: 970, height: 803 },
  /** 매트 캡션 baseline (y 클수록 아래) */
  baselineY: 652,
  /** 이름 시작 — PNG "FAMILY" 왼쪽 (오른쪽으로 갈수록 x 증가) */
  nameX: 230,
  /** 연도 시작 x — PNG "GATHERING," 쉼표 바로 다음 글자 */
  yearX: 576,
  fontSize: {
    mat: 17,
    longName: 16,
  },
  /** PNG 매트 sans (Futura 계열) — Montserrat는 layout.tsx에서 이미 로드됨 */
  typography: {
    fill: '#a8a39c',
    fontFamily: 'Montserrat, "Helvetica Neue", Helvetica, Arial, sans-serif',
    fontWeight: 400,
    letterSpacing: 1.6,
  },
} as const;

/** 대시보드 커스텀 타이틀 — 액자 매트 sans 와 동일 fontFamily */
export const BAROQUE_MAT_DASHBOARD_TITLE = {
  fontFamily: BAROQUE_MAT_LAYOUT.typography.fontFamily,
  fontWeight: '400' as const,
  letterSpacingPx: 1,
} as const;

export function baroqueMatFontSizeForName(nameLength: number): number {
  const { fontSize } = BAROQUE_MAT_LAYOUT;
  if (nameLength > 20) return fontSize.longName;
  return fontSize.mat;
}

export function baroqueMatFontSizeForYear(): number {
  return BAROQUE_MAT_LAYOUT.fontSize.mat;
}
