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
  /** 이름 시작 (BIG TUMMY 등) — PNG FAMILY 왼쪽 */
  nameX: 148,
  /**
   * 연도 시작 x — PNG "GATHERING," 쉼표 바로 다음 글자
   * (The Collection 스크립트와 겹치면 이 값을 줄이세요)
   */
  yearX: 576,
  fontSize: {
    short: 20,
    medium: 19,
    long: 18,
  },
  typography: {
    fill: '#9a948c',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    fontWeight: 300,
    letterSpacing: 2,
  },
} as const;

export function baroqueMatFontSizeForName(nameLength: number): number {
  const { fontSize } = BAROQUE_MAT_LAYOUT;
  if (nameLength > 18) return fontSize.long;
  if (nameLength > 12) return fontSize.medium;
  return fontSize.short;
}
