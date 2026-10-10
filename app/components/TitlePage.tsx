'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import FrameGestureHintOverlay, { type FrameGestureHintPhase } from './FrameGestureHintOverlay';
import Image from 'next/image';
import {
  PhotoFrameSVG,
  FRAME_CONFIGS,
  BAROQUE_FRAME_INSET_CLASS,
  MODERN_FRAME_INSET_CLASS,
  POLAROID_FRAME_INSET_CLASS,
  POLAROID_PAPER_BACKPLATE_CLASS,
  VINTAGE_FRAME_INSET_CLASS,
  EDITORIAL_FRAME_INSET_CLASS,
  GRADIENT_RIM_FRAME_INSET_CLASS,
  PARCHMENT_FRAME_INSET_CLASS,
  SOFT_GLASS_FRAME_INSET_CLASS,
  SOFT_GLASS_PHOTO_IMAGE_CLASS,
  BaroqueMatCaptionOverlay,
  PolaroidMatCaptionOverlay,
  ParchmentMatCaptionOverlay,
  VintageMatCaptionOverlay,
  formatBaroqueMatName,
  formatPolaroidMatName,
  formatVintageMatName,
  type FrameStyle,
} from './PhotoFrames';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getTitlePageTranslation } from '@/lib/translations/titlePage';
import { getCommonTranslation } from '@/lib/translations/common';
import { cn } from '@/lib/ui/cn';
import { readStoredFrameStyle, writeStoredFrameStyle } from '@/lib/preferences/photo-frame-style';
import {
  readPhotoFrameGestureHintSeen,
  writePhotoFrameGestureHintSeen,
} from '@/lib/preferences/photo-frame-gesture-hint';

const SWIPE_THRESHOLD_PX = 48;
const SLIDE_OFFSET_PX = 28;
const SLIDE_DURATION_SEC = 0.32;
/** 첫 안내 중에만 사진·액자 전환을 느리게 */
const HINT_SLIDE_DURATION_SEC = 0.95;


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

// 오늘의 무작위 사진 선택 함수 (날짜 시드 — 같은 날·같은 앨범이면 동일 인덱스)
const getTodayRandomPhoto = (photos: Array<{ id: number | string; data: string }>): number | null => {
  if (!photos || photos.length === 0) return null;
  const dateSeed = getDateHashSeed(new Date());
  const random = seededRandom(dateSeed);
  return Math.floor(random * photos.length);
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
  frameStyle?: FrameStyle;
  onFrameChange?: (style: FrameStyle) => void;
  onFrameClick?: () => void;
  /** 바로크 액자 매트 캡션용 그룹명 (family_name) */
  groupCaptionName?: string;
  /** 사진 세로/가로 — 대시보드 타이틀 정렬 연동 */
  onPhotoOrientationChange?: (isPortrait: boolean) => void;
  /** false면 액자 제스처 안내를 시작하지 않음 (위젯 쇼룸 등 선행 온보딩) */
  gestureHintEnabled?: boolean;
  /** @deprecated 안내는 브라우저당 한 번이라 그룹 ID를 쓰지 않습니다. */
  gestureHintScope?: string | null;
}

const DailyPhotoFrame: React.FC<DailyPhotoFrameProps> = ({
  photos,
  frameStyle = 'no_frame',
  onFrameChange,
  onFrameClick,
  groupCaptionName,
  onPhotoOrientationChange,
  gestureHintEnabled = true,
}) => {
  const { lang } = useLanguage();
  const tp = (key: keyof import('@/lib/translations/titlePage').TitlePageTranslations) => getTitlePageTranslation(lang, key);
  // Hydration 불일치 방지: 날짜/시드 기반 선택은 클라이언트 마운트 후에만 수행 (React #418)
  const [mounted, setMounted] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | number | null>(null);
  const [slideAxis, setSlideAxis] = useState<'x' | 'y'>('x');
  const [slideDir, setSlideDir] = useState(0);
  const [photoMotionNonce, setPhotoMotionNonce] = useState(0);
  const [hintPhase, setHintPhase] = useState<FrameGestureHintPhase | null>(null);
  const didSwipeRef = useRef(false);
  const pointerStartRef = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // blob/data URL 제외 → 업로드 직후 뒤로가기 시 Hydration/렌더 에러 근본 방지
  const stablePhotos = useMemo(
    () => (photos || []).filter((p) => p?.data && isStablePhotoUrl(p.data)),
    [photos]
  );

  const selectedPhoto = useMemo(() => {
    if (!mounted || stablePhotos.length === 0) return null;
    if (selectedPhotoId != null) {
      const found = stablePhotos.find((p) => String(p.id) === String(selectedPhotoId));
      if (found) return found;
    }
    const idx = getTodayRandomPhoto(stablePhotos);
    return idx == null ? null : stablePhotos[idx];
  }, [mounted, stablePhotos, selectedPhotoId]);

  // 세로/가로 자동 맞춤 복구: 사진 비율 캐시로 재진입 시 리플로우 최소화
  const imageAspectRatioCacheRef = useRef<Record<string, number>>({});
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);

  const reportPhotoOrientation = useCallback(
    (isPortrait: boolean) => {
      // 동일 값이어도 부모와 동기화 (부모 remount/state reset 후 미통지 방지)
      onPhotoOrientationChange?.(isPortrait);
    },
    [onPhotoOrientationChange],
  );

  const applyImageAspectRatio = useCallback(
    (photoId: string | number, naturalWidth: number, naturalHeight: number) => {
      if (!naturalWidth || !naturalHeight) return;
      const ratio = naturalWidth / naturalHeight;
      if (!Number.isFinite(ratio) || ratio <= 0) return;
      imageAspectRatioCacheRef.current[String(photoId)] = ratio;
      setImageAspectRatio((prev) => (prev === ratio ? prev : ratio));
    },
    [],
  );

  useEffect(() => {
    if (!selectedPhoto) {
      setImageAspectRatio(null);
      setImageLoadError(false);
      reportPhotoOrientation(false);
      return;
    }
    const cacheKey = String(selectedPhoto.id);
    const cachedRatio = imageAspectRatioCacheRef.current[cacheKey];
    const ratio = typeof cachedRatio === 'number' ? cachedRatio : null;
    setImageLoadError(false);
    setImageAspectRatio(ratio);
    // 캐시 hit 시에만 즉시 보고. null(=미확정)일 때 landscape(false)로 강제하지 않음
    if (ratio !== null) {
      reportPhotoOrientation(ratio < 1);
    }
  }, [selectedPhoto, reportPhotoOrientation]);

  const isPortraitPhoto = imageAspectRatio !== null && imageAspectRatio < 1;
  useEffect(() => {
    if (!selectedPhoto) return;
    // 비율 미확정 시 false로 덮어쓰지 않음 — 대시보드가 가로 타이틀 레이아웃에 고착되는 원인
    if (imageAspectRatio === null) return;
    reportPhotoOrientation(imageAspectRatio < 1);
  }, [selectedPhoto, imageAspectRatio, reportPhotoOrientation]);

  const completeHint = useCallback(() => {
    setHintPhase(null);
    writePhotoFrameGestureHintSeen();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!gestureHintEnabled) {
      setHintPhase(null);
      return;
    }
    if (readPhotoFrameGestureHintSeen()) return;
    const showTimer = setTimeout(() => setHintPhase('h'), 0);
    return () => clearTimeout(showTimer);
  }, [mounted, gestureHintEnabled]);

  const photoUndoRef = useRef<{ fromId: string | number; dir: number } | null>(null);

  const applyHorizontalSwipe = useCallback(
    (dir: number) => {
      setSlideAxis('x');
      setSlideDir(dir);
      setPhotoMotionNonce((n) => n + 1);

      const currentId = selectedPhoto?.id;
      const others = stablePhotos.filter((p) => String(p.id) !== String(currentId));
      if (others.length === 0) {
        photoUndoRef.current = null;
        return;
      }

      const undo = photoUndoRef.current;
      if (undo && undo.dir === -dir) {
        const prev = stablePhotos.find((p) => String(p.id) === String(undo.fromId));
        photoUndoRef.current = null;
        if (prev && String(prev.id) !== String(currentId)) {
          setSelectedPhotoId(prev.id);
          return;
        }
      }

      const next = others[Math.floor(Math.random() * others.length)];
      photoUndoRef.current = currentId != null ? { fromId: currentId, dir } : null;
      setSelectedPhotoId(next.id);
    },
    [stablePhotos, selectedPhoto],
  );

  const cycleFrame = useCallback(
    (indexDelta: number, animDir: number) => {
      if (!onFrameChange) return;
      const i = FRAME_CONFIGS.findIndex((f) => f.id === frameStyle);
      const idx = i < 0 ? 0 : i;
      const next = FRAME_CONFIGS[(idx + indexDelta + FRAME_CONFIGS.length) % FRAME_CONFIGS.length];
      if (next.id === frameStyle) return;
      setSlideAxis('y');
      setSlideDir(animDir);
      onFrameChange(next.id);
    },
    [frameStyle, onFrameChange],
  );

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    didSwipeRef.current = false;
    pointerStartRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const start = pointerStartRef.current;
      pointerStartRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
      if (!start || start.id !== e.pointerId) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.hypot(dx, dy) < SWIPE_THRESHOLD_PX) {
        if (hintPhase === 'h' || hintPhase === 'v') {
          didSwipeRef.current = true;
        }
        return;
      }
      didSwipeRef.current = true;
      if (Math.abs(dx) >= Math.abs(dy)) {
        applyHorizontalSwipe(dx < 0 ? -1 : 1);
        if (hintPhase === 'h') setHintPhase('v');
      } else {
        cycleFrame(dy < 0 ? 1 : -1, dy < 0 ? -1 : 1);
        if (hintPhase === 'v') setHintPhase('tap');
      }
    },
    [applyHorizontalSwipe, cycleFrame, hintPhase],
  );

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = null;
    didSwipeRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
  }, []);

  const handleFrameClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (didSwipeRef.current) {
        e.preventDefault();
        e.stopPropagation();
        didSwipeRef.current = false;
        return;
      }
      if (hintPhase === 'h' || hintPhase === 'v') {
        e.preventDefault();
        return;
      }
      if (hintPhase === 'tap') {
        completeHint();
      }
      onFrameClick?.();
    },
    [completeHint, hintPhase, onFrameClick],
  );

  const frameAspectClass = isPortraitPhoto ? 'aspect-[3/4]' : 'aspect-[4/3]';
  const frameInsetClass: Record<FrameStyle, string> = {
    baroque: BAROQUE_FRAME_INSET_CLASS,
    vintage: VINTAGE_FRAME_INSET_CLASS,
    modern: MODERN_FRAME_INSET_CLASS,
    soft_glass: SOFT_GLASS_FRAME_INSET_CLASS,
    polaroid_modern: POLAROID_FRAME_INSET_CLASS,
    editorial: EDITORIAL_FRAME_INSET_CLASS,
    gradient_rim: GRADIENT_RIM_FRAME_INSET_CLASS,
    parchment: PARCHMENT_FRAME_INSET_CLASS,
    no_frame: 'inset-0',
  };
  const useCoverImage =
    frameStyle === 'baroque' ||
    frameStyle === 'modern' ||
    frameStyle === 'vintage' ||
    frameStyle === 'soft_glass' ||
    frameStyle === 'polaroid_modern' ||
    frameStyle === 'editorial' ||
    frameStyle === 'gradient_rim' ||
    frameStyle === 'parchment' ||
    frameStyle === 'no_frame';
  const isSoftGlassFrame = frameStyle === 'soft_glass';
  const isPolaroidFrame = frameStyle === 'polaroid_modern';
  const isParchmentFrame = frameStyle === 'parchment';
  const photoInnerBgClass = 'bg-[#1a1a1a]';
  const frameWidthClass =
    frameStyle === 'polaroid_modern'
      ? isPortraitPhoto
        ? 'max-w-[360px] md:max-w-[380px]'
        : 'max-w-[min(92vw,420px)]'
      : isPortraitPhoto
        ? 'max-w-[320px] md:max-w-[340px]'
        : 'max-w-[380px]';

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

  const parchmentMatDisplayName = useMemo(() => {
    if (frameStyle !== 'parchment') return null;
    const name = formatPolaroidMatName(groupCaptionName ?? '');
    return name || null;
  }, [frameStyle, groupCaptionName]);

  const vintageMatDisplayName = useMemo(() => {
    if (frameStyle !== 'vintage') return null;
    const name = formatVintageMatName(groupCaptionName ?? '');
    return name || null;
  }, [frameStyle, groupCaptionName]);

  const slideEnterOffset = -slideDir * SLIDE_OFFSET_PX;
  const slideExitOffset = slideDir * SLIDE_OFFSET_PX;
  const slideDurationSec = hintPhase ? HINT_SLIDE_DURATION_SEC : SLIDE_DURATION_SEC;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className={cn('relative z-30 mb-6 mx-auto w-full', frameWidthClass)}
    >
      {/* 액자 주변 밀도 보강 (폴라로이드·양피지는 PNG 외곽 투명 → halo 제외) */}
      {!isPolaroidFrame && !isParchmentFrame && (
        <div className="pointer-events-none absolute -inset-x-6 -inset-y-5 -z-10 rounded-[28px] bg-[radial-gradient(ellipse_at_center,rgba(148,163,184,0.22)_0%,rgba(148,163,184,0.12)_45%,rgba(148,163,184,0)_75%)] blur-lg" />
      )}

      {/* SVG 프레임 컨테이너 (탭 → 사진첩, 좌우 셔플, 위아래 액자) */}
      <div
        role={onFrameClick ? 'button' : undefined}
        tabIndex={onFrameClick ? 0 : undefined}
        onClick={handleFrameClick}
        onKeyDown={onFrameClick ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (hintPhase === 'h' || hintPhase === 'v') return;
            if (hintPhase === 'tap') completeHint();
            onFrameClick();
          }
        } : undefined}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        aria-label={`${tp('gesture_hint_photo')}. ${tp('gesture_hint_frame')}. ${tp('gesture_hint_tap')}`}
        className={cn(
          'relative isolate w-full touch-none overflow-visible select-none',
          frameAspectClass,
          onFrameClick && 'cursor-pointer',
        )}
      >
        {isPolaroidFrame && (
          <div className={POLAROID_PAPER_BACKPLATE_CLASS} aria-hidden />
        )}
        {/* PNG 프레임 오버레이 — 투명 개구부, 사진 위에 프레임(z-15) */}
        <div className="absolute left-0 top-0 z-[15] h-full w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={frameStyle}
              initial={slideAxis === 'y' ? { opacity: 0, y: slideEnterOffset } : { opacity: 1 }}
              animate={{ opacity: 1, y: 0 }}
              exit={slideAxis === 'y' ? { opacity: 0, y: slideExitOffset } : { opacity: 1 }}
              transition={{ duration: slideDurationSec, ease: 'easeOut' }}
              className="absolute inset-0"
            >
              <PhotoFrameSVG frameStyle={frameStyle} />
            </motion.div>
          </AnimatePresence>
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
          {/* soft_glass: PNG 개구부 알파 = 둥근 모서리 / 사진 = 아주 약한 투명 */}
          <div
            className={cn(
              'relative h-full w-full overflow-hidden',
              !isSoftGlassFrame && 'rounded-[2px]',
              photoInnerBgClass,
            )}
          >
            <AnimatePresence mode="wait">
              {selectedPhoto && isStablePhotoUrl(selectedPhoto.data) && !imageLoadError ? (
                <motion.div
                  key={`${String(selectedPhoto.id)}-${photoMotionNonce}`}
                  initial={{
                    opacity: 0,
                    x: slideAxis === 'x' ? slideEnterOffset : 0,
                    y: slideAxis === 'y' ? slideEnterOffset : 0,
                  }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{
                    opacity: 0,
                    x: slideAxis === 'x' ? slideExitOffset : 0,
                    y: slideAxis === 'y' ? slideExitOffset : 0,
                  }}
                  transition={{ duration: slideDurationSec, ease: 'easeOut' }}
                  className="absolute inset-0 overflow-hidden"
                >
                  <Image
                    src={selectedPhoto.data}
                    alt={tp('photo_alt_today_memory')}
                    fill
                    className={cn(
                      useCoverImage ? 'object-cover' : 'object-contain',
                      isSoftGlassFrame && SOFT_GLASS_PHOTO_IMAGE_CLASS,
                      !isSoftGlassFrame &&
                        'shadow-[0_4px_24px_rgba(0,0,0,0.25),0_0_0_1px_rgba(0,0,0,0.05)]',
                    )}
                    unoptimized={true}
                    onLoad={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!selectedPhoto || !target) return;
                      applyImageAspectRatio(
                        selectedPhoto.id,
                        target.naturalWidth,
                        target.naturalHeight,
                      );
                    }}
                    onLoadingComplete={(img) => {
                      if (!selectedPhoto) return;
                      applyImageAspectRatio(
                        selectedPhoto.id,
                        img.naturalWidth,
                        img.naturalHeight,
                      );
                    }}
                    onError={() => setImageLoadError(true)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={`fallback-${photoMotionNonce}`}
                  initial={{
                    opacity: 0,
                    x: slideAxis === 'x' ? slideEnterOffset : 0,
                    y: slideAxis === 'y' ? slideEnterOffset : 0,
                  }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{
                    opacity: 0,
                    x: slideAxis === 'x' ? slideExitOffset : 0,
                    y: slideAxis === 'y' ? slideExitOffset : 0,
                  }}
                  transition={{ duration: slideDurationSec, ease: 'easeOut' }}
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

        {parchmentMatDisplayName ? (
          <ParchmentMatCaptionOverlay displayName={groupCaptionName ?? ''} />
        ) : null}

        {vintageMatDisplayName ? (
          <VintageMatCaptionOverlay displayName={groupCaptionName ?? ''} />
        ) : null}

        {hintPhase ? (
          <FrameGestureHintOverlay
            phase={hintPhase}
            photoLabel={tp('gesture_hint_photo')}
            frameLabel={tp('gesture_hint_frame')}
            tapLabel={tp('gesture_hint_tap')}
          />
        ) : null}
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

// 디자인 에디터 컴포넌트는 제거됨 (현재 editable={false} 고정으로 미사용)

// TitlePage 메인 컴포넌트
  


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
  /** false면 액자 제스처 안내 비활성 (기본 true) */
  gestureHintEnabled?: boolean;
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
  gestureHintEnabled = true,
}) => {
  const { lang } = useLanguage();
  const ct = (key: keyof import('@/lib/translations/common').CommonTranslations) => getCommonTranslation(lang, key);
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
          gestureHintEnabled={gestureHintEnabled}
          gestureHintScope={frameStyleStorageScope}
        />

        {/* 타이틀 텍스트 (showTitle이 true일 때만) */}
        {showTitle && (
          <TitleText 
            title={title || ct('app_title')} 
            titleStyle={titleStyle}
          />
        )}
      </div>
    </div>
  );
};

export default TitlePage;
export type { TitleStyle };
