'use client';

import React from 'react';
import {
  BAROQUE_MAT_LAYOUT,
  baroqueMatFontSizeForName,
  baroqueMatFontSizeForYear,
} from '@/lib/baroque-mat-layout';
import {
  POLAROID_MAT_LAYOUT,
  polaroidMatFontSizeForName,
  polaroidMatFontSizeForYear,
} from '@/lib/polaroid-mat-layout';

// 프레임 스타일 타입 정의
export type FrameStyle =
  | 'baroque'
  | 'modern'
  | 'vintage'
  | 'soft_glass'
  | 'polaroid_modern'
  | 'editorial'
  | 'gradient_rim'
  | 'parchment'
  | 'no_frame';

export interface FrameConfig {
  id: FrameStyle;
  name: string;
  description: string;
  color: string;
}

/** 모든 프레임 SVG 오버레이: 부모 기준 풀사이즈, 클릭 통과 */
const frameSvgOverlayClass =
  'pointer-events-none absolute inset-0 h-full w-full';

/** baroque-gold-landscape.png (970×803, 외곽·안쪽 흰 영역 투명) 사진 구역 inset */
export const BAROQUE_FRAME_INSET_CLASS =
  'left-[19.3%] right-[19.4%] top-[23.4%] bottom-[22.5%]';

export const BAROQUE_GOLD_LANDSCAPE_SRC =
  '/photo-frames/baroque-gold-landscape.png';

/** modern-wood-landscape.png (931×782 크롭, 외곽·개구부 투명) 사진 구역 inset */
export const MODERN_FRAME_INSET_CLASS =
  'left-[17.8%] right-[17.8%] top-[21.0%] bottom-[21.4%]';

export const MODERN_WOOD_LANDSCAPE_SRC =
  '/photo-frames/modern-wood-landscape.png';

/** vintage-frame-landscape.png (흰 배경 export → prepare-vintage-frame.mjs) */
export const VINTAGE_FRAME_INSET_CLASS =
  'left-[12.6%] right-[12.9%] top-[15%] bottom-[14.8%]';

export const VINTAGE_FRAME_LANDSCAPE_SRC =
  '/photo-frames/vintage-frame-landscape.png';

/** editorial-frame-landscape.png (496×372, 외곽·개구부 투명) 사진 구역 inset */
export const EDITORIAL_FRAME_INSET_CLASS =
  'left-[7.3%] right-[8.1%] top-[9.9%] bottom-[9.9%]';

export const EDITORIAL_FRAME_LANDSCAPE_SRC =
  '/photo-frames/editorial-frame-landscape.png';

/** gradient-frame-landscape.png (1024×1024, 외곽·개구부 투명) 사진 구역 inset */
export const GRADIENT_RIM_FRAME_INSET_CLASS =
  'left-[7.9%] right-[8.1%] top-[7.5%] bottom-[7.7%]';

export const GRADIENT_RIM_FRAME_LANDSCAPE_SRC =
  '/photo-frames/gradient-frame-landscape.png';

/** parchment-frame-landscape.png (prepare-parchment-frame.mjs) 사진 구역 inset */
export const PARCHMENT_FRAME_INSET_CLASS =
  'left-[6.3%] right-[6.8%] top-[8.2%] bottom-[7.1%]';

export const PARCHMENT_FRAME_LANDSCAPE_SRC =
  '/photo-frames/parchment-frame-landscape.png';

/** polaroid-paper-landscape.png (배경 크롭 후) 사진 구역 inset — scripts/crop-polaroid-bg.mjs */
export const POLAROID_FRAME_INSET_CLASS =
  'left-[10.4%] right-[9.4%] top-[10.7%] bottom-[16.7%]';

export const POLAROID_PAPER_LANDSCAPE_SRC =
  '/photo-frames/polaroid-paper-landscape.png';

/** prepare-polaroid-backplate-mask.mjs — 반투명 구간 전용 마스크 */
export const POLAROID_BACKPLATE_MASK_SRC =
  '/photo-frames/polaroid-paper-landscape-backplate-mask.png';

/**
 * PNG export 캔버스색 + 반투명 구간 전용 마스크
 * - 그림자·테두리(20<=alpha<252) 아래만 불투명 회색 — 보라 혼색 방지
 * - 불투명 종이·투명 코너는 마스크 제외 — 액자 밖 하얀/회색 박스 방지
 */
export const POLAROID_PAPER_BACKPLATE_CLASS =
  'pointer-events-none absolute inset-0 z-0 bg-[#e5e5e3] [-webkit-mask-image:url(/photo-frames/polaroid-paper-landscape-backplate-mask.png)] [-webkit-mask-size:100%_100%] [-webkit-mask-repeat:no-repeat] [mask-image:url(/photo-frames/polaroid-paper-landscape-backplate-mask.png)] [mask-size:100%_100%] [mask-repeat:no-repeat]';

/** soft-glass-landscape.png (prepare-soft-glass-frame.mjs) 사진 구역 inset */
export const SOFT_GLASS_FRAME_INSET_CLASS =
  'left-[6.6%] right-[7.1%] top-[9.2%] bottom-[9.4%]';

/** soft-glass PNG 오버레이 — baroque 등과 동일하게 object-fill(inset % 좌표 동기화) */
export const SOFT_GLASS_FRAME_OVERLAY_CLASS =
  `${frameSvgOverlayClass} object-fill`;

/**
 * soft_glass 사진 blur — img에 직접 filter (wrapper blur/transform 조합 금지)
 * 모서리 둥글림은 PNG 개구부 알fa가 담당, CSS clip radius 사용 안 함
 */
export const SOFT_GLASS_PHOTO_IMAGE_CLASS =
  'scale-[1.06] blur-[12px] brightness-[0.92]';

export const SOFT_GLASS_LANDSCAPE_SRC =
  '/photo-frames/soft-glass-landscape.png';

/** baroque-gold-landscape.png viewBox (크롭 후) */
const BAROQUE_FRAME_VIEWBOX = { width: 970, height: 803 } as const;

/** polaroid-paper-landscape.png viewBox — lib/polaroid-mat-layout.ts 와 동기화 */
const POLAROID_FRAME_VIEWBOX = POLAROID_MAT_LAYOUT.viewBox;

/**
 * PNG에 "FAMILY - GATHERING," 가 박혀 있으므로 이름 끝의 " Family" 접미사 제거.
 * "Happy Family" → "HAPPY", "Big Tummy Family" → "BIG TUMMY"
 */
export function formatBaroqueMatName(displayName: string): string {
  let base = displayName.trim();
  if (!base) return '';
  while (/\s+family\s*$/i.test(base)) {
    base = base.replace(/\s+family\s*$/i, '').trim();
  }
  return (base || displayName.trim()).toUpperCase();
}

/** 폴라로이드 하단 Lee 자리 — 스크립트용, Family 접미사만 제거 */
export function formatPolaroidMatName(displayName: string): string {
  let base = displayName.trim();
  if (!base) return '';
  while (/\s+family\s*$/i.test(base)) {
    base = base.replace(/\s+family\s*$/i, '').trim();
  }
  return base || displayName.trim();
}

/** @deprecated PNG에 FAMILY·GATHERING이 박혀 있으면 formatBaroqueMatName 사용 */
export function formatBaroqueMatCaption(displayName: string): string {
  const name = formatBaroqueMatName(displayName);
  if (!name) return '';
  const year = new Date().getFullYear();
  if (/\bFAMILY\b/i.test(displayName)) {
    return `${name} - GATHERING, ${year}`;
  }
  return `${name} FAMILY - GATHERING, ${year}`;
}

/** viewBox fontSize — @/lib/baroque-mat-layout.ts 참고 */

/**
 * PNG 매트 캡션 — 좌표는 lib/baroque-mat-layout.ts
 * [이름] FAMILY - GATHERING,[연도] The Collection…
 */

// 프레임 설정 목록
export const FRAME_CONFIGS: FrameConfig[] = [
  {
    id: 'baroque',
    name: '바로크',
    description: '화려하고 장식적인 클래식 프레임',
    color: '#b8860b',
  },
  {
    id: 'vintage',
    name: '빈티지',
    description: '우아한 빈티지 스타일 프레임',
    color: '#6b4423',
  },
  {
    id: 'modern',
    name: '모던',
    description: '우드 매트의 모던 프레임',
    color: '#8b6914',
  },
  {
    id: 'soft_glass',
    name: '소프트 글래스',
    description: '반투명 유리 질감의 트렌디 프레임',
    color: '#dbeafe',
  },
  {
    id: 'polaroid_modern',
    name: '폴라로이드 모던',
    description: '빈티지 폴라로이드 페이퍼 프레임',
    color: '#8a8272',
  },
  {
    id: 'editorial',
    name: '에디토리얼',
    description: '거의 무프레임에 가까운 세련된 스타일',
    color: '#111827',
  },
  {
    id: 'gradient_rim',
    name: '그라디언트 림',
    description: '얇은 컬러 림으로 포인트를 준 스타일',
    color: '#a78bfa',
  },
  {
    id: 'parchment',
    name: '양피지',
    description: '데클 가장자리와 클래식 장식의 빈티지 양피지',
    color: '#e8dcc8',
  },
  {
    id: 'no_frame',
    name: '프레임 없음',
    description: '대시보드 위젯과 동일한 카드 스타일',
    color: '#94a3b8',
  },
];

interface PhotoFrameSVGProps {
  frameStyle: FrameStyle;
  color?: string;
  width?: number;
  height?: number;
}

// 바로크 스타일 프레임 (PNG 오버레이)
const BaroqueFrame: React.FC<{ color: string; uid: string }> = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={BAROQUE_GOLD_LANDSCAPE_SRC}
    alt=""
    className={`${frameSvgOverlayClass} object-fill`}
  />
);

/** 바로크 매트 캡션 — PNG viewBox와 동일 좌표, 이름·연도만 오버레이 (FAMILY-GATHERING는 PNG) */
export function BaroqueMatCaptionOverlay({ displayName }: { displayName: string }) {
  const name = formatBaroqueMatName(displayName);
  if (!name) return null;
  const year = String(new Date().getFullYear());
  const { baselineY, nameX, yearX, typography } = BAROQUE_MAT_LAYOUT;
  const nameFontSize = baroqueMatFontSizeForName(name.length);
  const yearFontSize = baroqueMatFontSizeForYear();

  return (
    <svg
      viewBox={`0 0 ${BAROQUE_FRAME_VIEWBOX.width} ${BAROQUE_FRAME_VIEWBOX.height}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 z-[30] h-full w-full overflow-visible"
      aria-hidden
    >
      <text
        x={nameX}
        y={baselineY}
        fill={typography.fill}
        fontSize={nameFontSize}
        fontFamily={typography.fontFamily}
        fontWeight={typography.fontWeight}
        letterSpacing={typography.letterSpacing}
        textAnchor="start"
        dominantBaseline="alphabetic"
      >
        {name}
      </text>
      <text
        x={yearX}
        y={baselineY}
        fill={typography.fill}
        fontSize={yearFontSize}
        fontFamily={typography.fontFamily}
        fontWeight={typography.fontWeight}
        letterSpacing={typography.letterSpacing}
        textAnchor="start"
        dominantBaseline="alphabetic"
      >
        {` ${year}`}
      </text>
    </svg>
  );
}

/** 폴라로이드 하단 캡션 — PNG viewBox 좌표, 이름(Lee)·연도만 오버레이 */
export function PolaroidMatCaptionOverlay({ displayName }: { displayName: string }) {
  const name = formatPolaroidMatName(displayName);
  if (!name) return null;
  const year = String(new Date().getFullYear());
  const { baselineY, nameX, yearX, typography } = POLAROID_MAT_LAYOUT;
  const nameFontSize = polaroidMatFontSizeForName(name.length);
  const yearFontSize = polaroidMatFontSizeForYear();

  return (
    <svg
      viewBox={`0 0 ${POLAROID_FRAME_VIEWBOX.width} ${POLAROID_FRAME_VIEWBOX.height}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 z-[30] h-full w-full overflow-visible"
      aria-hidden
    >
      <text
        x={yearX}
        y={baselineY}
        fill={typography.fill}
        fontSize={yearFontSize}
        fontFamily={typography.fontFamily}
        fontWeight={typography.fontWeight}
        letterSpacing={typography.letterSpacing}
        textAnchor="end"
        dominantBaseline="alphabetic"
      >
        {year}
      </text>
      <text
        x={nameX}
        y={baselineY}
        fill={typography.fill}
        fontSize={nameFontSize}
        fontFamily={typography.fontFamily}
        fontWeight={typography.fontWeight}
        letterSpacing={typography.letterSpacing}
        textAnchor="end"
        dominantBaseline="alphabetic"
      >
        {` ${name}`}
      </text>
    </svg>
  );
}

// 빈티지 스타일 프레임 (PNG 오버레이)
const VintageFrame: React.FC<{ color: string; uid: string }> = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={VINTAGE_FRAME_LANDSCAPE_SRC}
    alt=""
    className={`${frameSvgOverlayClass} object-fill`}
  />
);

// 모던 스타일 프레임 (PNG 오버레이)
const ModernFrame: React.FC<{ color: string; uid: string }> = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={MODERN_WOOD_LANDSCAPE_SRC}
    alt=""
    className={`${frameSvgOverlayClass} object-fill`}
  />
);

// 소프트 글래스 스타일 프레임 (PNG 오버레이)
const SoftGlassFrame: React.FC<{ color: string; uid: string }> = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={SOFT_GLASS_LANDSCAPE_SRC}
    alt=""
    className={SOFT_GLASS_FRAME_OVERLAY_CLASS}
  />
);

// 폴라로이드 모던 스타일 프레임 (PNG 오버레이)
const PolaroidModernFrame: React.FC<{ color: string; uid: string }> = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={POLAROID_PAPER_LANDSCAPE_SRC}
    alt=""
    className={`${frameSvgOverlayClass} object-fill`}
  />
);

// 에디토리얼 스타일 프레임 (PNG 오버레이)
const EditorialFrame: React.FC<{ color: string; uid: string }> = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={EDITORIAL_FRAME_LANDSCAPE_SRC}
    alt=""
    className={`${frameSvgOverlayClass} object-fill`}
  />
);

// 프레임 없음(위젯 카드 스타일) - 컨테이너에서 글래스 토큰을 직접 적용하므로 SVG는 비움
const NoFrame: React.FC<{ color: string; uid: string }> = () => null;

// 그라디언트 림 스타일 프레임 (PNG 오버레이)
const GradientRimFrame: React.FC<{ color: string; uid: string }> = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={GRADIENT_RIM_FRAME_LANDSCAPE_SRC}
    alt=""
    className={`${frameSvgOverlayClass} object-fill`}
  />
);

// 양피지 스타일 프레임 (PNG 오버레이 — 외곽·개구부 투명)
const ParchmentFrame: React.FC<{ color: string; uid: string }> = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={PARCHMENT_FRAME_LANDSCAPE_SRC}
    alt=""
    className={`${frameSvgOverlayClass} object-fill`}
  />
);

// 메인 프레임 컴포넌트
export const PhotoFrameSVG: React.FC<PhotoFrameSVGProps> = ({
  frameStyle,
  color,
}) => {
  const uid = React.useId().replace(/:/g, '');
  const frameConfig = FRAME_CONFIGS.find(f => f.id === frameStyle);
  const frameColor = color || frameConfig?.color || '#5d2a1f';

  const FrameComponent = {
    baroque: BaroqueFrame,
    vintage: VintageFrame,
    modern: ModernFrame,
    soft_glass: SoftGlassFrame,
    polaroid_modern: PolaroidModernFrame,
    editorial: EditorialFrame,
    gradient_rim: GradientRimFrame,
    parchment: ParchmentFrame,
    no_frame: NoFrame,
  }[frameStyle];

  return <FrameComponent color={frameColor} uid={uid} />;
};
