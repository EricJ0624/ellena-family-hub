/**
 * polaroid-paper-landscape.png 하단 캡션 좌표 (viewBox = PNG px).
 * PNG baked: "Family Portrait," (가운데)
 * 코드 overlay: [연도] + [이름] — Lee 자리(우측 스크립트)
 * scripts/crop-polaroid-bg.mjs 크롭 후 width/height·inset 갱신
 */
export const POLAROID_MAT_LAYOUT = {
  viewBox: { width: 1165, height: 895 },
  baselineY: 860,
  /** Lee → 그룹 표시 이름 (우측 정렬) */
  nameX: 1045,
  /** 연도 — 이름 왼쪽 */
  yearX: 920,
  fontSize: {
    mat: 24,
    longName: 19,
  },
  typography: {
    fill: '#8a8272',
    fontFamily: '"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive',
    fontWeight: 400,
    letterSpacing: 0.5,
  },
} as const;

export function polaroidMatFontSizeForName(nameLength: number): number {
  const { fontSize } = POLAROID_MAT_LAYOUT;
  if (nameLength > 16) return fontSize.longName;
  return fontSize.mat;
}

export function polaroidMatFontSizeForYear(): number {
  return POLAROID_MAT_LAYOUT.fontSize.mat;
}
