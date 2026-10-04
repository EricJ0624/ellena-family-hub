/**
 * vintage-frame-landscape.png
 * FAMILY LEGACY 문구는 PNG 그대로 두고, 그 왼쪽 빈 명판에 가족 이름만 올린다.
 */
export const VINTAGE_MAT_LAYOUT = {
  viewBox: { width: 1095, height: 829 },
  /** 왼쪽 빈칸 중심. 리벳 뒤 ~580, FAMILY 시작 ~662, 글자 세로 767–789 */
  x: 612,
  y: 780,
  maxTextWidth: 72,
  /** 가로 폭은 유지하고 높이만 키움 */
  scaleY: 1.7,
  fontSize: {
    mat: 18,
    min: 12,
  },
  typography: {
    fill: '#2a1c12',
    fontFamily: 'Cinzel, "Times New Roman", Batang, serif',
    fontWeight: 700,
    letterSpacing: 1.2,
  },
} as const;

export function vintageMatFontSizeForName(nameLength: number): number {
  const { fontSize, maxTextWidth, typography } = VINTAGE_MAT_LAYOUT;
  if (nameLength <= 0) return fontSize.mat;
  const tracking = typography.letterSpacing * Math.max(0, nameLength - 1);
  const fitted = Math.floor((maxTextWidth - tracking) / (nameLength * 0.72));
  return Math.max(fontSize.min, Math.min(fontSize.mat, fitted));
}
