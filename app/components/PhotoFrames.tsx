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
  | 'ornate'
  | 'soft_glass'
  | 'polaroid_modern'
  | 'editorial'
  | 'gradient_rim'
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

/** vintage-frame-landscape.png (배경 크롭 후) 사진 구역 inset — scripts/crop-frame-bg.mjs */
export const VINTAGE_FRAME_INSET_CLASS =
  'left-[11.3%] right-[15.7%] top-[16.8%] bottom-[16.0%]';

export const VINTAGE_FRAME_LANDSCAPE_SRC =
  '/photo-frames/vintage-frame-landscape.png';

/** polaroid-paper-landscape.png (배경 크롭 후) 사진 구역 inset — scripts/crop-polaroid-bg.mjs */
export const POLAROID_FRAME_INSET_CLASS =
  'left-[10.4%] right-[9.4%] top-[10.7%] bottom-[16.7%]';

export const POLAROID_PAPER_LANDSCAPE_SRC =
  '/photo-frames/polaroid-paper-landscape.png';

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
    id: 'ornate',
    name: '오네이트',
    description: '정교한 조각 패턴의 고급 프레임',
    color: '#3e1a13',
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

// 오네이트 스타일 프레임 SVG
const OrnateFrame: React.FC<{ color: string; uid: string }> = ({ color, uid }) => {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="none" className={frameSvgOverlayClass}>
      <defs>
        <linearGradient id={`ornateWood-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} />
          <stop offset="50%" stopColor="#2a1208" />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
        
        <radialGradient id={`ornateGlow-${uid}`}>
          <stop offset="0%" stopColor="rgba(255,215,0,0.4)" />
          <stop offset="100%" stopColor="rgba(139,69,19,0)" />
        </radialGradient>
      </defs>

      {/* 외곽 프레임 - 두꺼운 테두리 */}
      <rect x="0" y="0" width="400" height="300" fill={`url(#ornateWood-${uid})`} />
      
      {/* 다층 테두리 효과 */}
      <rect x="8" y="8" width="384" height="284" fill="none" stroke="rgba(0,0,0,0.7)" strokeWidth="2" />
      <rect x="12" y="12" width="376" height="276" fill="none" stroke="rgba(139,69,19,0.8)" strokeWidth="1" />
      <rect x="18" y="18" width="364" height="264" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="3" />

      {/* 정교한 모서리 장식 */}
      {[
        { x: 15, y: 15, rotate: 0 },
        { x: 385, y: 15, rotate: 90 },
        { x: 385, y: 285, rotate: 180 },
        { x: 15, y: 285, rotate: 270 },
      ].map((corner, i) => (
        <g key={i} transform={`translate(${corner.x}, ${corner.y}) rotate(${corner.rotate})`}>
          <path
            d="M 0,0 L 25,0 L 20,5 L 5,5 L 0,25 Z"
            fill="rgba(139,69,19,0.9)"
            stroke="rgba(0,0,0,0.6)"
            strokeWidth="1"
          />
          <circle cx="12" cy="12" r="5" fill={`url(#ornateGlow-${uid})`} />
          <path
            d="M 5,5 Q 12,8 20,5"
            stroke="rgba(255,215,0,0.5)"
            strokeWidth="1.5"
            fill="none"
          />
        </g>
      ))}

      {/* 측면 장식 패턴 */}
      {[30, 60, 90, 120, 150, 180, 210, 240, 270].map((y, i) => (
        <g key={`left-${i}`}>
          <circle cx="10" cy={y} r="2" fill="rgba(255,215,0,0.3)" />
          <circle cx="390" cy={y} r="2" fill="rgba(255,215,0,0.3)" />
        </g>
      ))}
    </svg>
  );
};

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

// 소프트 글래스 스타일 프레임 SVG
const SoftGlassFrame: React.FC<{ color: string; uid: string }> = ({ color, uid }) => {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="none" className={frameSvgOverlayClass}>
      <defs>
        <linearGradient id={`softGlassFill-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.62)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.2)" />
        </linearGradient>
        <linearGradient id={`softGlassHighlight-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.78)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="400" height="300" rx="24" fill={`url(#softGlassFill-${uid})`} />
      <rect x="3" y="3" width="394" height="294" rx="21" fill="none" stroke="rgba(255,255,255,0.86)" strokeWidth="1.8" />
      <rect x="8" y="8" width="384" height="284" rx="17" fill="none" stroke={color} strokeOpacity="0.5" strokeWidth="1.2" />
      <rect x="0" y="0" width="400" height="100" rx="24" fill={`url(#softGlassHighlight-${uid})`} />
    </svg>
  );
};

// 폴라로이드 모던 스타일 프레임 (PNG 오버레이)
const PolaroidModernFrame: React.FC<{ color: string; uid: string }> = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={POLAROID_PAPER_LANDSCAPE_SRC}
    alt=""
    className={`${frameSvgOverlayClass} object-fill`}
  />
);

// 에디토리얼 스타일 프레임 SVG
const EditorialFrame: React.FC<{ color: string; uid: string }> = ({ color }) => {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="none" className={frameSvgOverlayClass}>
      <rect x="0" y="0" width="400" height="300" rx="10" fill="rgba(15,23,42,0.02)" />
      <rect x="3" y="3" width="394" height="294" rx="8" fill="none" stroke={color} strokeOpacity="0.85" strokeWidth="1.2" />
      <rect x="8" y="8" width="384" height="284" rx="6" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" />
    </svg>
  );
};

// 프레임 없음(위젯 카드 스타일) - 컨테이너에서 글래스 토큰을 직접 적용하므로 SVG는 비움
const NoFrame: React.FC<{ color: string; uid: string }> = () => null;

// 그라디언트 림 스타일 프레임 SVG
const GradientRimFrame: React.FC<{ color: string; uid: string }> = ({ color, uid }) => {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="none" className={frameSvgOverlayClass}>
      <defs>
        <linearGradient id={`gradientRimStroke-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="35%" stopColor={color} />
          <stop offset="70%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="400" height="300" rx="20" fill="rgba(15,23,42,0.04)" />
      <rect x="4" y="4" width="392" height="292" rx="18" fill="none" stroke={`url(#gradientRimStroke-${uid})`} strokeWidth="3" />
      <rect x="9" y="9" width="382" height="282" rx="14" fill="none" stroke="rgba(255,255,255,0.62)" strokeWidth="1" />
    </svg>
  );
};

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
    ornate: OrnateFrame,
    vintage: VintageFrame,
    modern: ModernFrame,
    soft_glass: SoftGlassFrame,
    polaroid_modern: PolaroidModernFrame,
    editorial: EditorialFrame,
    gradient_rim: GradientRimFrame,
    no_frame: NoFrame,
  }[frameStyle];

  return <FrameComponent color={frameColor} uid={uid} />;
};
