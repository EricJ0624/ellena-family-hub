'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, RefreshCw, Palette, X, Frame as FrameIcon } from 'lucide-react';
import Image from 'next/image';
import { PhotoFrameSVG, FRAME_CONFIGS, type FrameStyle } from './PhotoFrames';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getTitlePageTranslation } from '@/lib/translations/titlePage';
import { getCommonTranslation } from '@/lib/translations/common';


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
}

const DailyPhotoFrame: React.FC<DailyPhotoFrameProps> = ({
  photos,
  onShuffle,
  frameStyle = 'baroque',
  onFrameChange,
  onFrameClick,
}) => {
  const { lang } = useLanguage();
  const tp = (key: keyof import('@/lib/translations/titlePage').TitlePageTranslations) => getTitlePageTranslation(lang, key);
  const ct = (key: keyof import('@/lib/translations/common').CommonTranslations) => getCommonTranslation(lang, key);
  const [manualSeed, setManualSeed] = useState<number | undefined>(undefined);
  const [showFrameSelector, setShowFrameSelector] = useState(false);
  // Hydration 불일치 방지: 날짜/시드 기반 선택은 클라이언트 마운트 후에만 수행 (React #418)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 오늘의 사진 인덱스 계산 (클라이언트 마운트 후에만, 서버와 동일하게 초기에는 null)
  const photoIndex = useMemo(() => {
    if (!mounted) return null;
    return getTodayRandomPhoto(photos, manualSeed);
  }, [mounted, photos, manualSeed]);

  const selectedPhoto = photoIndex !== null && photos[photoIndex] ? photos[photoIndex] : null;
  
  // 수동 셔플 핸들러 (부드러운 페이드 효과)
  const handleShuffle = useCallback(() => {
    setManualSeed(Date.now());
  }, []);
  
  useEffect(() => {
    if (onShuffle) onShuffle();
  }, [manualSeed, onShuffle]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="relative mb-6 z-30"
      style={{
        width: '100%',
        maxWidth: '380px',
        margin: '0 auto',
      }}
    >
      {/* SVG 프레임 컨테이너 (클릭 시 가족 추억 페이지로 이동) */}
      <div
        role={onFrameClick ? 'button' : undefined}
        tabIndex={onFrameClick ? 0 : undefined}
        onClick={onFrameClick}
        onKeyDown={onFrameClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFrameClick(); } } : undefined}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4/3',
          overflow: 'visible',
          cursor: onFrameClick ? 'pointer' : undefined,
        }}
      >
        {/* SVG 프레임 (배경) */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))',
        }}>
          <PhotoFrameSVG frameStyle={frameStyle} />
        </div>

        {/* 내부 매트(Matte) - 크림색 여백 */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            right: '20px',
            bottom: '20px',
            borderRadius: '4px',
            overflow: 'hidden',
            background: '#f5f5dc',
            padding: '12px',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.15), inset 0 -1px 4px rgba(0,0,0,0.1)',
          }}
        >
          {/* 가족 사진 영역 */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            {/* 사진 또는 Fallback */}
            <AnimatePresence mode="wait">
              {selectedPhoto ? (
                <motion.div
                  key={`${selectedPhoto.id}-${manualSeed || 'default'}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <Image
                    src={selectedPhoto.data}
                    alt={tp('photo_alt_today_memory')}
                    fill
                    style={{
                      objectFit: 'contain',
                    }}
                    unoptimized={true}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="fallback"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #f5e6d3 0%, #e8d5c4 100%)',
                  }}
                >
                  <div style={{ fontSize: '4rem' }}>📷</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        {/* 버튼 그룹 (우측 하단) - 클릭 시 액자 클릭(이동) 방지 */}
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            display: 'flex',
            gap: '8px',
            zIndex: 40,
          }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {/* 프레임 선택 버튼 */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowFrameSelector(!showFrameSelector)}
            style={{
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: showFrameSelector 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              border: '3px solid #8B4513',
              borderRadius: '50%',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.8)',
              cursor: 'pointer',
            }}
            aria-label={tp('frame_change')}
            title={tp('frame_change')}
          >
            <FrameIcon 
              className="w-5 h-5" 
              style={{ color: showFrameSelector ? '#ffffff' : '#8B4513' }}
              strokeWidth={2.5} 
            />
          </motion.button>

          {/* 사진 새로고침 버튼 */}
          {selectedPhoto && (
            <motion.button
              whileHover={{ scale: 1.15, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleShuffle}
              style={{
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                border: '3px solid #8B4513',
                borderRadius: '50%',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.8)',
                cursor: 'pointer',
              }}
              aria-label={tp('photo_refresh')}
              title={tp('photo_refresh')}
            >
              <RefreshCw className="w-5 h-5 text-[#8B4513]" strokeWidth={2.5} />
            </motion.button>
          )}
        </div>

        {/* 프레임 선택 패널 - 클릭 시 액자 클릭(이동) 방지 */}
        <AnimatePresence>
          {showFrameSelector && (
            <motion.div
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'absolute',
                bottom: '70px',
                right: '10px',
                background: 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                padding: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                border: '2px solid rgba(139, 69, 19, 0.3)',
                zIndex: 50,
                minWidth: '200px',
              }}
            >
              <div style={{ 
                fontSize: '12px', 
                fontWeight: '600', 
                color: '#5d2a1f',
                marginBottom: '8px',
                paddingBottom: '8px',
                borderBottom: '1px solid rgba(139, 69, 19, 0.2)',
              }}>
                {tp('frame_style_select')}
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
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
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      background: frameStyle === frame.id 
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : 'transparent',
                      color: frameStyle === frame.id ? '#ffffff' : '#333',
                      border: frameStyle === frame.id 
                        ? '2px solid #667eea'
                        : '2px solid rgba(139, 69, 19, 0.2)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: frameStyle === frame.id ? '600' : '500',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        background: frame.color,
                        border: '1px solid rgba(0,0,0,0.2)',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontWeight: '600' }}>{tp(`frame_${frame.id}` as keyof import('@/lib/translations/titlePage').TitlePageTranslations)}</div>
                      <div style={{ 
                        fontSize: '10px', 
                        opacity: 0.8,
                        marginTop: '2px',
                      }}>
                        {tp(`frame_${frame.id}_desc` as keyof import('@/lib/translations/titlePage').TitlePageTranslations)}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
  return (
    <motion.h1
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      onClick={onTitleClick}
      className={`text-center select-none mb-6 relative z-30 ${onTitleClick ? 'cursor-pointer' : 'cursor-default'}`}
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
      {titleStyle.content || title}
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
      className="fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100] rounded-2xl shadow-2xl overflow-hidden"
      style={{
        width: '90%',
        maxWidth: '480px',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 그라데이션 헤더 */}
      <div 
        className="relative px-6 py-5 text-white"
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">디자인 수정</h3>
              <p className="text-xs text-white/80">타이틀 스타일을 자유롭게 변경하세요</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
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
            글자 내용
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
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all appearance-none bg-white cursor-pointer"
            style={{
              fontFamily: localStyle.fontFamily || 'Inter',
            }}
          >
            {fontFamilies.map((font) => (
              <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
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
                className="w-16 h-16 rounded-xl border-2 border-gray-200 cursor-pointer hover:scale-105 transition-transform"
                style={{
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                }}
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
              className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
              style={{
                background: `linear-gradient(to right, #667eea 0%, #667eea ${fontSizeProgress}%, #e5e7eb ${fontSizeProgress}%, #e5e7eb 100%)`,
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
            폰트 두께
          </label>
          <select
            value={localStyle.fontWeight}
            onChange={(e) => handleChange('fontWeight', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all cursor-pointer"
          >
            <option value="300">Light (300)</option>
            <option value="400">Normal (400)</option>
            <option value="500">Medium (500)</option>
            <option value="600">Semi Bold (600)</option>
            <option value="700">Bold (700)</option>
            <option value="800">Extra Bold (800)</option>
            <option value="900">Black (900)</option>
          </select>
        </div>
        
        {/* 자간 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
              자간
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
              className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
              style={{
                background: `linear-gradient(to right, #667eea 0%, #667eea ${letterSpacingProgress}%, #e5e7eb ${letterSpacingProgress}%, #e5e7eb 100%)`,
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
            className={`w-3 h-3 rounded-full ${
              index % 4 === 0
                ? 'bg-pink-300'
                : index % 4 === 1
                ? 'bg-blue-300'
                : index % 4 === 2
                ? 'bg-purple-300'
                : 'bg-yellow-300'
            }`}
            style={{
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
            }}
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
  /** false면 타이틀 텍스트 미표시 (대시보드에서 한 줄 타이틀을 별도 사용할 때) */
  showTitle?: boolean;
  /** true면 배경 그라데이션/패턴 제거 (투명) */
  noBackground?: boolean;
  /** 액자 클릭 시 호출 (예: 가족 추억 페이지로 이동) */
  onFrameClick?: () => void;
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
}) => {
  const { lang } = useLanguage();
  const ct = (key: keyof import('@/lib/translations/common').CommonTranslations) => getCommonTranslation(lang, key);
  const [showEditor, setShowEditor] = useState(false);
  const [frameStyle, setFrameStyle] = useState<FrameStyle>('baroque');
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
      className="relative w-full min-h-[240px] md:min-h-[280px] flex flex-col items-center justify-center overflow-visible rounded-2xl mb-4"
      style={{
        background: noBackground ? 'transparent' : 'linear-gradient(to bottom right, #e0f2fe 0%, #e9d5ff 50%, #fce7f3 100%)',
        paddingTop: '8px'
      }}
    >
      {!noBackground && (
        <>
          {/* 배경 그라데이션 */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom right, #e0f2fe 0%, #e9d5ff 50%, #fce7f3 100%)',
            }}
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
              className="w-64 h-64 md:w-80 md:h-80" 
              style={{ 
                color: '#ec4899', 
                fill: '#ec4899',
                opacity: 0.1
              }}
            />
          </motion.div>
        )}

        {/* 오늘의 무작위 사진 액자 (사진 없어도 액자 표시, 추후 기본 디자인 추가 예정) */}
        <DailyPhotoFrame
          photos={photos || []}
          frameStyle={frameStyle}
          onFrameChange={setFrameStyle}
          onFrameClick={onFrameClick}
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
