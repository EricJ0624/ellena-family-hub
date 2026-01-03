'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Home, RefreshCw, Palette, X } from 'lucide-react';
import Image from 'next/image';

// 상수 분리 - 텍스트 내용 관리
const CONSTANTS = {
  TITLE: 'Ellena Family Hub',
  DEFAULT_TITLE: 'Ellena Family Hub',
} as const;

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
const getTodayRandomPhoto = (photos: Array<{ id: number; data: string }>, manualSeed?: number): number | null => {
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
  photos: Array<{ id: number; data: string }>;
  onShuffle?: () => void;
}

const DailyPhotoFrame: React.FC<DailyPhotoFrameProps> = ({ photos, onShuffle }) => {
  const [manualSeed, setManualSeed] = useState<number | undefined>(undefined);
  const [isFading, setIsFading] = useState(false);
  
  // 오늘의 사진 인덱스 계산 (메모이제이션)
  const photoIndex = useMemo(() => {
    return getTodayRandomPhoto(photos, manualSeed);
  }, [photos, manualSeed]);
  
  const selectedPhoto = photoIndex !== null ? photos[photoIndex] : null;
  
  // 수동 셔플 핸들러 (부드러운 페이드 효과)
  const handleShuffle = useCallback(() => {
    // 즉시 새로운 시드 생성하여 다른 사진 선택
    // AnimatePresence의 mode="wait"가 자동으로 페이드 효과 처리
    setManualSeed(Date.now());
  }, []);
  
  useEffect(() => {
    if (onShuffle) {
      onShuffle();
    }
  }, [manualSeed, onShuffle]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="relative mb-4 z-30"
      style={{
        width: '280px',
        height: '210px',
        maxWidth: '90%',
      }}
    >
      {/* 고급스러운 우드 프레임 */}
      <div
        className="relative w-full h-full rounded-lg overflow-hidden"
        style={{
          border: '12px solid transparent',
          background: 'linear-gradient(#8B4513, #8B4513) padding-box, linear-gradient(135deg, #8B4513 0%, #A0522D 25%, #8B4513 50%, #654321 75%, #8B4513 100%) border-box',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.4), inset 0 3px 15px rgba(139, 69, 19, 0.6), inset 0 -3px 15px rgba(101, 67, 33, 0.4)',
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        {/* 우드 텍스처 오버레이 */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            backgroundImage: `
              repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(101, 67, 33, 0.1) 2px, rgba(101, 67, 33, 0.1) 4px),
              repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(160, 82, 45, 0.1) 2px, rgba(160, 82, 45, 0.1) 4px)
            `,
            opacity: 0.6,
          }}
        />
        
        {/* 장식용 코너 장식 */}
        <div
          className="absolute top-0 left-0 w-8 h-8 z-20"
          style={{
            borderTop: '3px solid #654321',
            borderLeft: '3px solid #654321',
            borderTopLeftRadius: '4px',
          }}
        />
        <div
          className="absolute top-0 right-0 w-8 h-8 z-20"
          style={{
            borderTop: '3px solid #654321',
            borderRight: '3px solid #654321',
            borderTopRightRadius: '4px',
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-8 h-8 z-20"
          style={{
            borderBottom: '3px solid #654321',
            borderLeft: '3px solid #654321',
            borderBottomLeftRadius: '4px',
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-8 h-8 z-20"
          style={{
            borderBottom: '3px solid #654321',
            borderRight: '3px solid #654321',
            borderBottomRightRadius: '4px',
          }}
        />
        
        {/* 사진 컨테이너 - border 영역을 제외한 내부 영역 */}
        <div className="absolute inset-[12px] z-0">
          <AnimatePresence mode="wait">
            {selectedPhoto ? (
              <motion.div
                key={`${selectedPhoto.id}-${manualSeed || 'default'}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="relative w-full h-full"
              >
                <Image
                  src={selectedPhoto.data}
                  alt="오늘의 추억"
                  fill
                  style={{
                    objectFit: 'cover',
                    objectPosition: 'center',
                  }}
                  unoptimized={true}
                />
                {/* 은은한 우드 질감 오버레이 */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139, 69, 19, 0.05) 0%, rgba(101, 67, 33, 0.03) 50%, rgba(0, 0, 0, 0.02) 100%)',
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="fallback"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #f5e6d3 0%, #e8d5c4 100%)',
                }}
              >
                <div className="text-6xl">📷</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* 새로고침 버튼 (우측 하단) - 눈에 잘 띄는 스타일 */}
        {selectedPhoto && (
          <motion.button
            whileHover={{ scale: 1.15, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleShuffle}
            className="absolute bottom-4 right-4 p-2.5 rounded-full shadow-xl transition-all z-40"
            style={{
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              border: '3px solid #8B4513',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.8)',
              cursor: 'pointer',
            }}
            aria-label="사진 새로고침"
            title="사진 새로고침"
          >
            <RefreshCw className="w-5 h-5 text-[#8B4513]" strokeWidth={2.5} />
          </motion.button>
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
  return (
    <motion.h1
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      onClick={onTitleClick}
      className="text-center cursor-pointer select-none mb-6 relative z-30"
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
      {titleStyle.content || title || CONSTANTS.DEFAULT_TITLE}
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
  const [localStyle, setLocalStyle] = useState<TitleStyle>(titleStyle);
  
  // 인기 있는 웹 폰트 목록 (메모이제이션)
  const fontFamilies = useMemo(() => [
    { value: 'Inter', label: 'Inter (모던)', category: 'Sans-serif' },
    { value: 'Roboto', label: 'Roboto (깔끔)', category: 'Sans-serif' },
    { value: 'Poppins', label: 'Poppins (세련)', category: 'Sans-serif' },
    { value: 'Montserrat', label: 'Montserrat (강렬)', category: 'Sans-serif' },
    { value: 'Playfair Display', label: 'Playfair Display (우아)', category: 'Serif' },
    { value: 'Merriweather', label: 'Merriweather (전통)', category: 'Serif' },
    { value: 'Lora', label: 'Lora (읽기 좋음)', category: 'Serif' },
    { value: 'Dancing Script', label: 'Dancing Script (손글씨)', category: 'Script' },
    { value: 'Pacifico', label: 'Pacifico (캐주얼)', category: 'Script' },
    { value: 'Arial', label: 'Arial (기본)', category: 'Sans-serif' },
    { value: 'Georgia', label: 'Georgia (클래식)', category: 'Serif' },
    { value: 'Times New Roman', label: 'Times New Roman (전통)', category: 'Serif' },
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
            aria-label="닫기"
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
            placeholder="타이틀 텍스트를 입력하세요"
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
                {font.label}
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
            x: Math.random() * 100 + '%',
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
            duration: Math.random() * 10 + 15,
            repeat: Infinity,
            delay: Math.random() * 5,
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
  photos?: Array<{ id: number; data: string }>;
  titleStyle?: Partial<TitleStyle>;
  onTitleStyleChange?: (style: TitleStyle) => void;
}

const TitlePage: React.FC<TitlePageProps> = ({ 
  title, 
  onTitleClick,
  photos = [],
  titleStyle: externalTitleStyle,
  onTitleStyleChange
}) => {
  const [showEditor, setShowEditor] = useState(false);
  const [internalTitleStyle, setInternalTitleStyle] = useState<TitleStyle>({
    content: title || CONSTANTS.DEFAULT_TITLE,
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
  
  // 타이틀 클릭 핸들러 (디자인 에디터 표시)
  const handleTitleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // 타이틀 클릭 시 디자인 에디터 표시
    setShowEditor(!showEditor);
  }, [showEditor]);
  
  return (
    <div 
      className="relative w-full min-h-[240px] md:min-h-[280px] flex flex-col items-center justify-center overflow-visible rounded-2xl mb-4"
      style={{
        background: 'linear-gradient(to bottom right, #e0f2fe 0%, #e9d5ff 50%, #fce7f3 100%)',
        paddingTop: '8px'
      }}
    >
      {/* 배경 그라데이션 */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom right, #e0f2fe 0%, #e9d5ff 50%, #fce7f3 100%)',
        }}
      />
      
      {/* 떠다니는 꽃잎 */}
      <FloatingPetals />
      
      {/* 네트워크 패턴 배경 */}
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

      {/* 컨텐츠 영역 */}
      <div className="relative z-20 flex flex-col items-center justify-center px-4 pt-4 pb-4 w-full min-h-[240px]">
        {/* 배경 하트 아이콘 (투명) */}
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

        {/* 오늘의 무작위 사진 액자 */}
        {photos && photos.length > 0 && (
          <DailyPhotoFrame photos={photos} />
        )}

        {/* 타이틀 텍스트 */}
        <TitleText 
          title={title || CONSTANTS.TITLE} 
          titleStyle={titleStyle}
          onTitleClick={handleTitleClick} 
        />
      </div>
      
      {/* 디자인 에디터 (타이틀 클릭 시 표시) - 모달 오버레이와 함께 */}
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
    </div>
  );
};

export default TitlePage;
export { CONSTANTS };
export type { TitleStyle };
