/**
 * parchment-frame-landscape.png 오른쪽 아래 빈칸 좌표 (viewBox = PNG px).
 * 코드 overlay: 가족 이름 — 장식선 안쪽 가운데
 */
export const PARCHMENT_MAT_LAYOUT = {
  viewBox: { width: 1012, height: 735 },
  /** 빈칸 아래쪽. 왼쪽 계단 ~633, 오른쪽 테 ~940, 위 ~540, 아래 장식 ~670 */
  x: 790,
  y: 626,
  /** SVG rotate: 음수 = 시계 반대. 손글씨처럼 아주 살짝 */
  rotate: -7,
  /** 장식선 안쪽 가용 폭 */
  maxTextWidth: 250,
  fontSize: {
    mat: 46,
    min: 28,
  },
  typography: {
    fill: '#6b5e52',
    fontFamily: '"Dancing Script", Gaegu, cursive',
    fontWeight: 400,
  },
} as const;

export function parchmentMatFontSizeForName(nameLength: number): number {
  const { fontSize, maxTextWidth } = PARCHMENT_MAT_LAYOUT;
  if (nameLength <= 0) return fontSize.mat;
  const fitted = Math.floor(maxTextWidth / (nameLength * 0.55));
  return Math.max(fontSize.min, Math.min(fontSize.mat, fitted));
}
