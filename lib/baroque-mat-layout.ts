/**
 * baroque-gold-landscape.png 매트 동적 텍스트 좌표 (viewBox 970×803).
 * 스크린샷으로 맞출 때는 이 파일만 수정하면 됩니다.
 *
 * PNG에 baked: "FAMILY - GATHERING," (가운데) + "The Collection" (스크립트, 오른쪽)
 * 코드 overlay: PNG sans 구간을 패치로 가리고 전체 캡션을 SVG 한 줄로 렌더
 */
export const BAROQUE_MAT_LAYOUT = {
  viewBox: { width: 970, height: 803 },
  /** 매트 캡션 baseline (y 클수록 아래) */
  baselineY: 652,
  /** 전체 캡션 한 줄 가운데 정렬 anchor x */
  captionCenterX: 485,
  /** 이름(BIG TUMMY)과 FAMILY 사이 추가 공백 — 늘리면 간격 증가 */
  nameFamilyGap: '   ',
  /** PNG baked "FAMILY - GATHERING," 가리는 매트 패치 (texture 근사색) */
  bakedTextPatch: {
    x: 300,
    y: 633,
    width: 440,
    height: 28,
    fill: '#ebe7df',
  },
  fontSize: {
    mat: 17,
    /** 이름이 매우 길 때만 1px 축소 */
    longName: 16,
  },
  /** 전체 sans 캡션 공통 — Montserrat는 layout.tsx에서 이미 로드됨 */
  typography: {
    fill: '#a8a39c',
    fontFamily: 'Montserrat, "Helvetica Neue", Helvetica, Arial, sans-serif',
    fontWeight: 400,
    letterSpacing: 1.6,
  },
} as const;

export function baroqueMatFontSizeForName(nameLength: number): number {
  const { fontSize } = BAROQUE_MAT_LAYOUT;
  if (nameLength > 20) return fontSize.longName;
  return fontSize.mat;
}

/** @deprecated 한 줄 렌더 — 이름 fontSize와 동일 */
export function baroqueMatFontSizeForYear(): number {
  return BAROQUE_MAT_LAYOUT.fontSize.mat;
}

/** `[이름]   FAMILY - GATHERING, [연도]` — 단일 SVG text용 */
export function buildBaroqueMatCaptionLine(name: string, year: number | string): string {
  const { nameFamilyGap } = BAROQUE_MAT_LAYOUT;
  return `${name}${nameFamilyGap}FAMILY - GATHERING, ${year}`;
}
