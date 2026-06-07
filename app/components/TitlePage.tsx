'use client';

import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, RefreshCw, Palette, X, Frame as FrameIcon } from 'lucide-react';
import Image from 'next/image';
import {
  PhotoFrameSVG,
  FRAME_CONFIGS,
  BAROQUE_FRAME_INSET_CLASS,
  MODERN_FRAME_INSET_CLASS,
  POLAROID_FRAME_INSET_CLASS,
  VINTAGE_FRAME_INSET_CLASS,
  SOFT_GLASS_FRAME_INSET_CLASS,
  BaroqueMatCaptionOverlay,
  PolaroidMatCaptionOverlay,
  formatBaroqueMatName,
  formatPolaroidMatName,
  type FrameStyle,
} from './PhotoFrames';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getTitlePageTranslation } from '@/lib/translations/titlePage';
import { getCommonTranslation } from '@/lib/translations/common';
import { cn } from '@/lib/ui/cn';
import { readStoredFrameStyle, writeStoredFrameStyle } from '@/lib/preferences/photo-frame-style';


// 날짜 기반 해시 시드 생성 함수
const getDateHashSeed = (date: Date): string => {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return dateStr;
};

// 해시 기반 시드 랜덤 함수 (일관된 랜덤 생성)
const seededRandom = (seed: string): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // 0~1 사이의 값으로 정규화
  return Math.abs(hash % 10000) / 10000;
};

// 대시보드 표시용으로만 사용할 수 있는 안정적인 URL인지 (blob/data 제외 → Hydration/렌더 에러 방지)
// 일반 업로드 프록시 경로도 포함 (액자에 표시)
const isStablePhotoUrl = (url: string): boolean =>
  !!url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/api/photo/proxy'));

// 오늘의 무작위 사진 선택 함수
const getTodayRandomPhoto = (photos: Array<{ id: number | string; data: string }>, manualSeed?: number): number | null => {
  if (!photos || photos.length === 0) return null;
  
  const today = new Date();
  const dateSeed = getDateHashSeed(today);
  const seed = manualSeed !== undefined ? `manual_${manualSeed}` : dateSeed;
  const random = seededRandom(seed);
  
  const index = Math.floor(random * photos.length);
  return index;
};

// 타이틀 스타일 타입 정의
interface TitleStyle {
  content: string;
  color: string;
  fontSize: number;
  fontWeight: string;
  letterSpacing: number;
  fontFamily: string;
}

// 오늘의 무작위 사진 액자 컴포넌트
interface DailyPhotoFrameProps {
  photos: Array<{ id: number | string; data: string }>;
  onShuffle?: () => void;
  frameStyle?: FrameStyle;
  onFrameChange?: (style: FrameStyle) => void;
  onFrameClick?: () => void;
  /** 바로크 액자 매트 캡션용 그룹명 (family_name) */
  groupCaptionName?: string;
  /** 사진 세로/가로 — 대시보드 타이틀 정렬 연동 */
  onPhotoOrientationChange?: (isPortrait: boolean) => void;
}

const DailyPhotoFrame: React.FC<DailyPhotoFrameProps> = ({
  photos,
  onShuffle,
  frameStyle = 'no_frame',
  onFrameChange,
  onFrameClick,
  groupCaptionName,
  onPhotoOrientationChange,
}) => {
  const { lang } = useLanguage();
  const tp = (key: keyof import('@/lib/translations/titlePage').TitlePageTranslations) => getTitlePageTranslation(lang, key);
  const ct = (key: keyof import('@/lib/translations/common').CommonTranslations) => getCommonTranslation(lang, key);
  const [manualSeed, setManualSeed] = useState<number | undefined>(undefined);
  const [showFrameSelector, setShowFrameSelector] = useState(false);
  const frameButtonRef = useRef<HTMLButtonElement>(null);
  const [framePanelLayout, setFramePanelLayout] = useState<{
    bottom?: number;
    top?: number;
    right: number;
    maxHeight: number;
  } | null>(null);
  // Hydration 불일치 방지: 날짜/시드 기반 선택은 클라이언트 마운트 후에만 수행 (React #418)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const updateFramePanelLayout = useCallback(() => {
    const el = frameButtonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const gap = 8;
    const maxCap = 420;
    const vhCap = window.innerHeight * 0.55;
    const spaceAbove = rect.top - margin;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const preferAbove = spaceAbove >= spaceBelow || spaceAbove >= 140;

    if (preferAbove) {
      setFramePanelLayout({
        bottom: window.innerHeight - rect.top + gap,
        right: Math.max(margin, window.innerWidth - rect.right),
        maxHeight: Math.max(120, Math.min(maxCap, vhCap, spaceAbove - gap)),
      });
    } else {
      setFramePanelLayout({
        top: rect.bottom + gap,
        right: Math.max(margin, window.innerWidth - rect.right),
        maxHeight: Math.max(120, Math.min(maxCap, vhCap, spaceBelow - gap)),
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (!showFrameSelector) {
      setFramePanelLayout(null);
      return;
    }
    updateFramePanelLayout();
    window.addEventListener('resize', updateFramePanelLayout);
    window.addEventListener('scroll', updateFramePanelLayout, true);
    return () => {
      window.removeEventListener('resize', updateFramePanelLayout);
      window.removeEventListener('scroll', updateFramePanelLayout, true);
    };
  }, [showFrameSelector, updateFramePanelLayout]);

  // blob/data URL 제외 → 업로드 직후 뒤로가기 시 Hydration/렌더 에러 근본 방지
  const stablePhotos = useMemo(
    () => (photos || []).filter((p) => p?.data && isStablePhotoUrl(p.data)),
    [photos]
  );

  // 오늘의 사진 인덱스 계산 (클라이언트 마운트 후에만, 안정 URL만 후보)
  const photoIndex = useMemo(() => {
    if (!mounted || stablePhotos.length === 0) return null;
    return getTodayRandomPhoto(stablePhotos, manualSeed);
  }, [mounted, stablePhotos, manualSeed]);

  const selectedPhoto = photoIndex !== null && stablePhotos[photoIndex] ? stablePhotos[photoIndex] : null;

  // 세로/가로 자동 맞춤 복구: 사진 비율 캐시로 재진입 시 리플로우 최소화
  const imageAspectRatioCacheRef = useRef<Record<string, number>>({});
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  useEffect(() => {
    if (!selectedPhoto) {
      setImageAspectRatio(null);
      setImageLoadError(false);
      onPhotoOrientationChange?.(false);
      return;
    }
    const cacheKey = String(selectedPhoto.id);
    const cachedRatio = imageAspectRatioCacheRef.current[cacheKey];
    const ratio = typeof cachedRatio === 'number' ? cachedRatio : null;
    setImageAspectRatio(ratio);
    if (ratio !== null) {
      onPhotoOrientationChange?.(ratio < 1);
    }
  }, [selectedPhoto, onPhotoOrientationChange]);

  // 수동 셔플 핸들러 (부드러운 페이드 효과)
  const handleShuffle = useCallback(() => {
    setManualSeed(Date.now());
  }, []);

  const isPortraitPhoto = imageAspectRatio !== null && imageAspectRatio < 1;
  useEffect(() => {
    if (imageAspectRatio === null) {
      onPhotoOrientationChange?.(false);
      return;
    }
    onPhotoOrientationChange?.(imageAspectRatio < 1);
  }, [imageAspectRatio, onPhotoOrientationChange]);

  const frameAspectClass = isPortraitPhoto ? 'aspect-[3/4]' : 'aspect-[4/3]';
  const frameInsetClass: Record<FrameStyle, string> = {
    baroque: BAROQUE_FRAME_INSET_CLASS,
    ornate: 'inset-[20px]',
    vintage: VINTAGE_FRAME_INSET_CLASS,
    modern: MODERN_FRAME_INSET_CLASS,
    soft_glass: SOFT_GLASS_FRAME_INSET_CLASS,
    polaroid_modern: POLAROID_FRAME_INSET_CLASS,
    editorial: 'inset-[10px]',
    gradient_rim: 'inset-[12px]',
    no_frame: 'inset-0',
  };
  const useCoverImage =
    frameStyle === 'vintage' ||
    frameStyle === 'soft_glass' ||
    frameStyle === 'polaroid_modern' ||
    frameStyle === 'editorial' ||
    frameStyle === 'no_frame';
  const isSoftGlassFrame = frameStyle === 'soft_glass';
  const photoInnerBgClass = 'bg-[#1a1a1a]';
  const frameWidthClass = isPortraitPhoto ? 'max-w-[320px] md:max-w-[340px]' : 'max-w-[380px]';

  const baroqueMatDisplayName = useMemo(() => {
    if (frameStyle !== 'baroque') return null;
    const name = formatBaroqueMatName(groupCaptionName ?? '');
    return name || null;
  }, [frameStyle, groupCaptionName]);

  const polaroidMatDisplayName = useMemo(() => {
    if (frameStyle !== 'polaroid_modern') return null;
    const name = formatPolaroidMatName(groupCaptionName ?? '');
    return name || null;
  }, [frameStyle, groupCaptionName]);
  
  useEffect(() => {
    if (onShuffle) onShuffle();
  }, [manualSeed, onShuffle]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className={cn('relative z-30 mb-6 mx-auto w-full', frameWidthClass)}
    >
      {/* 액자 주변 밀도 보강: noBackground 대시보드에서도 빈 느낌 완화 */}
      <div className="pointer-events-none absolute -inset-x-6 -inset-y-5 -z-10 rounded-[28px] bg-[radial-gradient(ellipse_at_center,rgba(148,163,184,0.22)_0%,rgba(148,163,184,0.12)_45%,rgba(148,163,184,0)_75%)] blur-lg" />

      {/* SVG 프레임 컨테이너 (클릭 시 가족 추억 페이지로 이동) */}
      <div
        role={onFrameClick ? 'button' : undefined}
        tabIndex={onFrameClick ? 0 : undefined}
        onClick={onFrameClick}
        onKeyDown={onFrameClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFrameClick(); } } : undefined}
        className={cn('relative w-full overflow-visible', frameAspectClass, onFrameClick && 'cursor-pointer')}
      >
        {/* PNG 프레임 오버레이 — 투명 개구부, 사진 위에 프레임(z-15) */}
        <div className="absolute left-0 top-0 z-[15] h-full w-full">
          <PhotoFrameSVG frameStyle={frameStyle} />
        </div>

        {/* 내부 사진 영역 */}
        <div
          className={cn(
            'absolute z-[10] overflow-hidden',
            frameStyle === 'no_frame'
              ? 'rounded-[2rem] border border-glass-medium bg-glass-medium shadow-glass-medium backdrop-blur-glass-medium'
              : 'rounded',
            frameInsetClass[frameStyle],
          )}
        >
          {/* soft_glass: PNG 개구부 알파가 둥근 모서리 마스크 / blur 사진 */}
          <div className={cn('relative h-full w-full overflow-hidden rounded-[2px]', photoInnerBgClass)}>
            <AnimatePresence mode="wait">
              {selectedPhoto && isStablePhotoUrl(selectedPhoto.data) && !imageLoadError ? (
                <motion.div
                  key={String(selectedPhoto.id)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="absolute inset-0"
                >
                  <div className="absolute inset-0 isolate overflow-hidden">
                    <Image
                      src={selectedPhoto.data}
                      alt={tp('photo_alt_today_memory')}
                      fill
                      className={cn(
                        useCoverImage ? 'object-cover' : 'object-contain',
                        isSoftGlassFrame &&
                          'scale-[1.08] blur-lg brightness-105 saturate-110 [transform:translateZ(0)]',
                        !isSoftGlassFrame &&
                          'shadow-[0_4px_24px_rgba(0,0,0,0.25),0_0_0_1px_rgba(0,0,0,0.05)]',
                      )}
                      unoptimized={true}
                      onLoad={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target?.naturalWidth || !target?.naturalHeight || !selectedPhoto) return;
                        const ratio = target.naturalWidth / target.naturalHeight;
                        const cacheKey = String(selectedPhoto.id);
                        imageAspectRatioCacheRef.current[cacheKey] = ratio;
                        setImageAspectRatio((prev) => (prev === ratio ? prev : ratio));
                      }}
                      onError={() => setImageLoadError(true)}
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="fallback"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a]"
                >
                  <img
                    src="/frame-default.png"
                    alt=""
                    className="block h-full w-full object-cover"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {baroqueMatDisplayName ? (
          <BaroqueMatCaptionOverlay displayName={groupCaptionName ?? ''} />
        ) : null}

        {polaroidMatDisplayName ? (
          <PolaroidMatCaptionOverlay displayName={groupCaptionName ?? ''} />
        ) : null}

        {/* 버튼 그룹 (우측 하단) - 클릭 시 액자 클릭(이동) 방지 */}
        <div
          className="absolute bottom-2.5 right-2.5 z-40 flex gap-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {/* 프레임 선택 버튼 */}
          <motion.button
            ref={frameButtonRef}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowFrameSelector(!showFrameSelector)}
            className={cn(
              'flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-[3px] border-[#8B4513] shadow-[0_6px_20px_rgba(0,0,0,0.4),inset_0_2px_4px_rgba(255,255,255,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70',
              showFrameSelector
                ? 'bg-[linear-gradient(135deg,rgb(var(--brand-primary))_0%,rgb(var(--brand-secondary))_100%)]'
                : 'bg-[linear-gradient(135deg,#ffffff_0%,#f8f9fa_100%)]',
            )}
            aria-label={tp('frame_change')}
            title={tp('frame_change')}
          >
            <FrameIcon 
              className={cn('h-5 w-5', showFrameSelector ? 'text-white' : 'text-[#8B4513]')}
              strokeWidth={2.5} 
            />
          </motion.button>

          {/* 사진 새로고침 버튼 */}
          {selectedPhoto && (
            <motion.button
              whileHover={{ scale: 1.15, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleShuffle}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-[3px] border-[#8B4513] bg-[linear-gradient(135deg,#ffffff_0%,#f8f9fa_100%)] shadow-[0_6px_20px_rgba(0,0,0,0.4),inset_0_2px_4px_rgba(255,255,255,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
              aria-label={tp('photo_refresh')}
              title={tp('photo_refresh')}
            >
              <RefreshCw className="w-5 h-5 text-[#8B4513]" strokeWidth={2.5} />
            </motion.button>
          )}
        </div>

        {/* 프레임 선택 패널 — body 포탈 + 버튼 위 여유 공간 기준 maxHeight (.app-header overflow 클리핑 회피) */}
        {typeof document !== 'undefined' &&
          showFrameSelector &&
          framePanelLayout &&
          createPortal(
            <AnimatePresence>
              <motion.div
                key="frame-selector-panel"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: 'fixed',
                  right: framePanelLayout.right,
                  maxHeight: framePanelLayout.maxHeight,
                  ...(framePanelLayout.bottom != null
                    ? { bottom: framePanelLayout.bottom }
                    : { top: framePanelLayout.top }),
                }}
                className="z-[120] min-w-[220px] max-w-[min(92vw,320px)] overflow-y-auto overscroll-contain rounded-xl border-2 border-[rgba(139,69,19,0.3)] bg-[rgba(255,255,255,0.98)] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-[10px] [touch-action:pan-y]"
              >
                <div className="mb-2 border-b border-[rgba(139,69,19,0.2)] pb-2 text-xs font-semibold text-[#5d2a1f]">
                  {tp('frame_style_select')}
                </div>
                <div className="flex flex-col gap-1.5">
                  {FRAME_CONFIGS.map((frame) => (
                    <motion.button
                      key={frame.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (onFrameChange) {
                          onFrameChange(frame.id);
                        }
                        setShowFrameSelector(false);
                      }}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-[13px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70',
                        frameStyle === frame.id
                          ? 'border-[rgb(var(--brand-primary))] bg-[linear-gradient(135deg,rgb(var(--brand-primary))_0%,rgb(var(--brand-secondary))_100%)] font-semibold text-white'
                          : 'border-[rgba(139,69,19,0.2)] bg-transparent font-medium text-[#333]',
                      )}
                    >
                      <div
                        className="h-5 w-5 shrink-0 rounded border border-[rgba(0,0,0,0.2)]"
                        style={{ background: frame.color }}
                      />
                      <div className="flex-1 text-left">
                        <div className="font-semibold">{tp(`frame_${frame.id}` as keyof import('@/lib/translations/titlePage').TitlePageTranslations)}</div>
                        <div className="mt-0.5 text-[10px] opacity-80">
                          {tp(`frame_${frame.id}_desc` as keyof import('@/lib/translations/titlePage').TitlePageTranslations)}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>,
            document.body,
          )}
      </div>
    </motion.div>
  );
};

// 타이틀 텍스트 컴포넌트
interface TitleTextProps {
  title: string;
  titleStyle: TitleStyle;
  onTitleClick?: (e: React.MouseEvent) => void;
}

const TitleText: React.FC<TitleTextProps> = ({ title, titleStyle, onTitleClick }) => {
  const raw = titleStyle.content || title;
  const parenMatch = typeof raw === 'string' && raw.match(/^(.*?)(\s*\([^)]+\))(.*)$/);
  const titleContent = parenMatch ? (
    <>
      {parenMatch[1]}
      <span className="align-baseline text-[0.65em]">{parenMatch[2]}</span>
      {parenMatch[3]}
    </>
  ) : raw;
  return (
    <motion.h1
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      onClick={onTitleClick}
      className={cn('relative z-30 mb-6 select-none text-center', onTitleClick ? 'cursor-pointer' : 'cursor-default')}
      style={{
        color: titleStyle.color,
        fontSize: `${titleStyle.fontSize}px`,
        fontWeight: titleStyle.fontWeight,
        letterSpacing: `${titleStyle.letterSpacing}px`,
        fontFamily: titleStyle.fontFamily || 'Inter, sans-serif',
        pointerEvents: 'auto',
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      }}
    >
      {titleContent}
    </motion.h1>
  );
};

// 디자인 에디터 컴포넌트
interface DesignEditorProps {
  titleStyle: TitleStyle;
  onStyleChange: (style: TitleStyle) => void;
  onClose: () => void;
}

const DesignEditor: React.FC<DesignEditorProps> = ({ titleStyle, onStyleChange, onClose }) => {
  const { lang } = useLanguage();
  const tp = (key: keyof import('@/lib/translations/titlePage').TitlePageTranslations) => getTitlePageTranslation(lang, key);
  const ct = (key: keyof import('@/lib/translations/common').CommonTranslations) => getCommonTranslation(lang, key);
  const [localStyle, setLocalStyle] = useState<TitleStyle>(titleStyle);
  
  // 인기 있는 웹 폰트 목록 (메모이제이션) — 라벨은 tp('font_*')로 표시
  const fontOptionKeys: Record<string, keyof import('@/lib/translations/titlePage').TitlePageTranslations> = {
    'Inter': 'font_inter',
    'Roboto': 'font_roboto',
    'Poppins': 'font_poppins',
    'Montserrat': 'font_montserrat',
    'Playfair Display': 'font_playfair_display',
    'Merriweather': 'font_merriweather',
    'Lora': 'font_lora',
    'Dancing Script': 'font_dancing_script',
    'Pacifico': 'font_pacifico',
    'Arial': 'font_arial',
    'Georgia': 'font_georgia',
    'Times New Roman': 'font_times_new_roman',
  };
  const fontFamilies = useMemo(() => [
    { value: 'Inter', category: 'Sans-serif' },
    { value: 'Roboto', category: 'Sans-serif' },
    { value: 'Poppins', category: 'Sans-serif' },
    { value: 'Montserrat', category: 'Sans-serif' },
    { value: 'Playfair Display', category: 'Serif' },
    { value: 'Merriweather', category: 'Serif' },
    { value: 'Lora', category: 'Serif' },
    { value: 'Dancing Script', category: 'Script' },
    { value: 'Pacifico', category: 'Script' },
    { value: 'Arial', category: 'Sans-serif' },
    { value: 'Georgia', category: 'Serif' },
    { value: 'Times New Roman', category: 'Serif' },
  ], []);
  
  // titleStyle prop이 변경될 때 localStyle 업데이트
  useEffect(() => {
    setLocalStyle(titleStyle);
  }, [titleStyle]);
  
  const handleChange = useCallback((field: keyof TitleStyle, value: any) => {
    const newStyle = { ...localStyle, [field]: value };
    setLocalStyle(newStyle);
    onStyleChange(newStyle);
  }, [localStyle, onStyleChange]);
  
  // 슬라이더 진행률 계산 (메모이제이션)
  const fontSizeProgress = useMemo(() => {
    return ((localStyle.fontSize - 24) / (72 - 24)) * 100;
  }, [localStyle.fontSize]);
  
  const letterSpacingProgress = useMemo(() => {
    return ((localStyle.letterSpacing + 2) / 12) * 100;
  }, [localStyle.letterSpacing]);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -20 }}
      transition={{ duration: 0.2 }}
      className="fixed left-1/2 top-1/2 z-[100] max-h-[90vh] w-[90%] max-w-[480px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 그라데이션 헤더 */}
      <div 
        className="relative bg-[linear-gradient(135deg,rgb(var(--brand-primary))_0%,rgb(var(--brand-secondary))_100%)] px-6 py-5 text-white"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{tp('design_edit_title')}</h3>
              <p className="text-xs text-white/80">{tp('design_edit_subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label={ct('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* 컨텐츠 영역 */}
      <div className="bg-white p-6 space-y-5">
        {/* 글자 내용 */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            {tp('content_label')}
          </label>
          <input
            type="text"
            value={localStyle.content}
            onChange={(e) => handleChange('content', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
            placeholder={tp('title_placeholder')}
          />
        </div>
        
        {/* 글꼴 선택 */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            글꼴
          </label>
          <select
            value={localStyle.fontFamily || 'Inter'}
            onChange={(e) => handleChange('fontFamily', e.target.value)}
            className="w-full appearance-none cursor-pointer rounded-xl border-2 border-gray-200 bg-white px-4 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus:border-purple-500"
          >
            {fontFamilies.map((font) => (
              <option key={font.value} value={font.value}>
                {tp(fontOptionKeys[font.value])}
              </option>
            ))}
          </select>
        </div>
        
        {/* 색상 선택 */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            색상
          </label>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="color"
                value={localStyle.color}
                onChange={(e) => handleChange('color', e.target.value)}
                className="h-16 w-16 cursor-pointer rounded-xl border-2 border-gray-200 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 [appearance:none] [-moz-appearance:none]"
              />
            </div>
            <input
              type="text"
              value={localStyle.color}
              onChange={(e) => handleChange('color', e.target.value)}
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all font-mono text-sm"
              placeholder="#9333ea"
            />
          </div>
        </div>
        
        {/* 폰트 크기 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
              폰트 크기
            </label>
            <span className="text-sm font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-lg">
              {localStyle.fontSize}px
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="24"
              max="72"
              value={localStyle.fontSize}
              onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
              className="h-3 w-full appearance-none cursor-pointer rounded-lg bg-gray-200 accent-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
              style={{
                background: `linear-gradient(to right, rgb(var(--brand-primary)) 0%, rgb(var(--brand-primary)) ${fontSizeProgress}%, #e5e7eb ${fontSizeProgress}%, #e5e7eb 100%)`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>24px</span>
            <span>72px</span>
          </div>
        </div>
        
        {/* 폰트 두께 */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            {tp('font_weight_label')}
          </label>
          <select
            value={localStyle.fontWeight}
            onChange={(e) => handleChange('fontWeight', e.target.value)}
            className="w-full cursor-pointer rounded-xl border-2 border-gray-200 px-4 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus:border-purple-500"
          >
            <option value="300">{tp('font_weight_300')}</option>
            <option value="400">{tp('font_weight_400')}</option>
            <option value="500">{tp('font_weight_500')}</option>
            <option value="600">{tp('font_weight_600')}</option>
            <option value="700">{tp('font_weight_700')}</option>
            <option value="800">{tp('font_weight_800')}</option>
            <option value="900">{tp('font_weight_900')}</option>
          </select>
        </div>
        
        {/* 자간 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
              {tp('letter_spacing_label')}
            </label>
            <span className="text-sm font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-lg">
              {localStyle.letterSpacing}px
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="-2"
              max="10"
              step="0.5"
              value={localStyle.letterSpacing}
              onChange={(e) => handleChange('letterSpacing', parseFloat(e.target.value))}
              className="h-3 w-full appearance-none cursor-pointer rounded-lg bg-gray-200 accent-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
              style={{
                background: `linear-gradient(to right, rgb(var(--brand-primary)) 0%, rgb(var(--brand-primary)) ${letterSpacingProgress}%, #e5e7eb ${letterSpacingProgress}%, #e5e7eb 100%)`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>-2px</span>
            <span>10px</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// 떠다니는 꽃잎 컴포넌트
const FloatingPetals: React.FC = () => {
  const petals = Array.from({ length: 8 }, (_, i) => i);
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[5]">
      {petals.map((index) => (
        <motion.div
          key={index}
          initial={{
            x: `${(index * 17) % 100}%`, // 인덱스 기반 결정적 위치
            y: -20,
            opacity: 0.6,
            rotate: 0,
          }}
          animate={{
            y: '100vh',
            rotate: 360,
            opacity: [0.6, 0.8, 0.4, 0.6],
          }}
          transition={{
            duration: 15 + (index % 10), // 인덱스 기반 결정적 지속 시간
            repeat: Infinity,
            delay: index * 0.5, // 인덱스 기반 결정적 지연
            ease: 'linear',
          }}
          className="absolute"
        >
          <div
            className={`h-3 w-3 rounded-full [clip-path:polygon(50%_0%,0%_100%,100%_100%)] ${
              index % 4 === 0
                ? 'bg-pink-300'
                : index % 4 === 1
                ? 'bg-blue-300'
                : index % 4 === 2
                ? 'bg-purple-300'
                : 'bg-yellow-300'
            }`}
          />
        </motion.div>
      ))}
    </div>
  );
};

// TitlePage 메인 컴포넌트
interface TitlePageProps {
  title?: string;
  onTitleClick?: () => void;
  photos?: Array<{ id: number | string; data: string }>;
  titleStyle?: Partial<TitleStyle>;
  onTitleStyleChange?: (style: TitleStyle) => void;
  /** false면 타이틀 클릭 시 디자인 에디터 미표시 (읽기 전용) */
  editable?: boolean;
  /** 액자 매트 캡션 (대시보드 타이틀과 별도 — pending 시 Hearth) */
  frameCaptionName?: string;
  /** false면 타이틀 텍스트 미표시 (대시보드에서 한 줄 타이틀을 별도 사용할 때) */
  showTitle?: boolean;
  /** true면 배경 그라데이션/패턴 제거 (투명) */
  noBackground?: boolean;
  /** 액자 클릭 시 호출 (예: 가족 추억 페이지로 이동) */
  onFrameClick?: () => void;
  /** 설정 시 localStorage에 프레임 선택 저장·복원 (예: 그룹 ID) */
  frameStyleStorageScope?: string | null;
  /** 액자 사진 세로 여부 — 대시보드 타이틀 정렬 */
  onPhotoOrientationChange?: (isPortrait: boolean) => void;
}

const TitlePage: React.FC<TitlePageProps> = ({
  title,
  onTitleClick,
  photos = [],
  titleStyle: externalTitleStyle,
  onTitleStyleChange,
  editable = true,
  showTitle = true,
  noBackground = false,
  onFrameClick,
  frameStyleStorageScope,
  frameCaptionName,
  onPhotoOrientationChange,
}) => {
  const { lang } = useLanguage();
  const ct = (key: keyof import('@/lib/translations/common').CommonTranslations) => getCommonTranslation(lang, key);
  const [showEditor, setShowEditor] = useState(false);
  const [frameStyle, setFrameStyle] = useState<FrameStyle>('no_frame');

  useEffect(() => {
    if (!frameStyleStorageScope) return;
    const stored = readStoredFrameStyle(frameStyleStorageScope);
    if (stored) setFrameStyle(stored);
  }, [frameStyleStorageScope]);

  const handleFrameChange = useCallback(
    (style: FrameStyle) => {
      setFrameStyle(style);
      if (frameStyleStorageScope) {
        writeStoredFrameStyle(frameStyleStorageScope, style);
      }
    },
    [frameStyleStorageScope],
  );
  const [internalTitleStyle, setInternalTitleStyle] = useState<TitleStyle>({
    content: title || ct('app_title'),
    color: '#9333ea',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: 0,
    fontFamily: 'Inter',
  });
  
  // 외부에서 전달된 titleStyle이 있으면 사용, 없으면 내부 상태 사용
  const titleStyle = externalTitleStyle 
    ? { ...internalTitleStyle, ...externalTitleStyle }
    : internalTitleStyle;
  
  // 타이틀 스타일 변경 핸들러
  const handleStyleChange = useCallback((newStyle: TitleStyle) => {
    setInternalTitleStyle(newStyle);
    if (onTitleStyleChange) {
      onTitleStyleChange(newStyle);
    }
  }, [onTitleStyleChange]);
  
  // 타이틀 클릭 핸들러 (editable일 때만 디자인 에디터 표시)
  const handleTitleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editable) return;
    setShowEditor((prev) => !prev);
  }, [editable]);
  
  return (
    <div
      className={`relative mb-4 flex min-h-[240px] w-full flex-col items-center justify-center overflow-visible rounded-2xl pt-2 md:min-h-[280px] ${
        noBackground
          ? 'bg-transparent'
          : 'bg-[linear-gradient(to_bottom_right,#e0f2fe_0%,#e9d5ff_50%,#fce7f3_100%)]'
      }`}
    >
      {!noBackground && (
        <>
          {/* 배경 그라데이션 */}
          <div 
            className="absolute inset-0 bg-[linear-gradient(to_bottom_right,#e0f2fe_0%,#e9d5ff_50%,#fce7f3_100%)]"
          />
          {/* 떠다니는 꽃잎 */}
          <FloatingPetals />
        </>
      )}
      
      {/* 네트워크 패턴 배경 */}
      {!noBackground && (
      <div className="absolute inset-0 opacity-20 z-0">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="network"
              x="0"
              y="0"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="20" cy="20" r="1.5" fill="#94a3b8" />
              <line
                x1="20"
                y1="0"
                x2="20"
                y2="40"
                stroke="#cbd5e1"
                strokeWidth="0.5"
              />
              <line
                x1="0"
                y1="20"
                x2="40"
                y2="20"
                stroke="#cbd5e1"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#network)" />
        </svg>
      </div>
      )}

      {/* 컨텐츠 영역 */}
      <div className="relative z-20 flex flex-col items-center justify-center px-4 pt-4 pb-4 w-full min-h-[240px]">
        {!noBackground && (
          /* 배경 하트 아이콘 (투명) */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <Heart 
              className="h-64 w-64 text-pink-500 opacity-10 fill-pink-500 md:h-80 md:w-80"
            />
          </motion.div>
        )}

        {/* 오늘의 무작위 사진 액자 (사진 없어도 액자 표시, 추후 기본 디자인 추가 예정) */}
        <DailyPhotoFrame
          photos={photos || []}
          frameStyle={frameStyle}
          onFrameChange={handleFrameChange}
          onFrameClick={onFrameClick}
          groupCaptionName={frameCaptionName ?? title ?? 'Hearth'}
          onPhotoOrientationChange={onPhotoOrientationChange}
        />

        {/* 타이틀 텍스트 (showTitle이 true일 때만) */}
        {showTitle && (
          <TitleText 
            title={title || ct('app_title')} 
            titleStyle={titleStyle}
            onTitleClick={editable ? handleTitleClick : undefined} 
          />
        )}
      </div>
      
      {/* 디자인 에디터 (editable일 때만, 타이틀 클릭 시 표시) */}
      {editable && (
      <AnimatePresence>
        {showEditor && (
          <>
            {/* 모달 오버레이 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditor(false)}
              className="fixed inset-0 bg-black/30 z-[99]"
            />
            {/* 에디터 */}
            <DesignEditor
              titleStyle={titleStyle}
              onStyleChange={handleStyleChange}
              onClose={() => setShowEditor(false)}
            />
          </>
        )}
      </AnimatePresence>
      )}
    </div>
  );
};

export default TitlePage;
export { DesignEditor };
export type { TitleStyle };
