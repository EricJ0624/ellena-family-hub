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
  /** 이름 시작 — PNG "FAMILY" 바로 왼쪽 (오른쪽으로 갈수록 x 증가) */
  nameX: 272,
  /**
   * 연도 시작 x — PNG "GATHERING," 쉼표 바로 다음 글자
   */
  yearX: 576,
  /** PNG 매트 "FAMILY - GATHERING," 와 동일 크기 — 이름·연도 공통 */
  fontSize: {
    mat: 18,
    /** 이름이 매우 길 때만 1px 축소 */
    longName: 17,
  },
  /** PNG 매트 sans (Futura 계열) — Montserrat는 layout.tsx에서 이미 로드됨 */
  typography: {
    fill: '#a8a39c',
    fontFamily: 'Montserrat, "Helvetica Neue", Helvetica, Arial, sans-serif',
    fontWeight: 500,
    letterSpacing: 1.8,
  },
} as const;

/** 이름·연도 동일 fontSize — PNG baked 텍스트와 맞춤 */
export function baroqueMatFontSizeForName(nameLength: number): number {
  const { fontSize } = BAROQUE_MAT_LAYOUT;
  if (nameLength > 20) return fontSize.longName;
  return fontSize.mat;
}

/** 연도는 항상 mat 기본 크기 */
export function baroqueMatFontSizeForYear(): number {
  return BAROQUE_MAT_LAYOUT.fontSize.mat;
}
