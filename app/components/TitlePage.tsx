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
  
  // 수동 셔플 핸들러
  const handleShuffle = useCallback(() => {
    setIsFading(true);
    setTimeout(() => {
      setManualSeed(Date.now());
      setIsFading(false);
    }, 300); // 페이드 애니메이션 시간
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
        width: '200px',
        height: '150px',
        maxWidth: '90%',
      }}
    >
      {/* 입체적인 화이트 딥 프레임 */}
      <div
        className="relative w-full h-full rounded-lg overflow-hidden"
        style={{
          border: '8px solid #ffffff',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), inset 0 2px 10px rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
          background: 'rgba(255, 255, 255, 0.95)',
        }}
      >
        {/* 사진 또는 Fallback */}
        <AnimatePresence mode="wait">
          {selectedPhoto ? (
            <motion.div
              key={selectedPhoto.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: isFading ? 0 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative w-full h-full"
            >
              <Image
                src={selectedPhoto.data}
                alt="오늘의 추억"
                fill
                style={{
                  objectFit: 'cover',
                }}
                unoptimized={true}
              />
              {/* 은은한 유리 질감 오버레이 */}
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 50%, rgba(0, 0, 0, 0.05) 100%)',
                  backdropFilter: 'blur(1px)',
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="fallback"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%)',
              }}
            >
              <Home className="w-12 h-12 text-gray-400" />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* 새로고침 버튼 (우측 하단) */}
        {selectedPhoto && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleShuffle}
            className="absolute bottom-2 right-2 p-2 rounded-full bg-white/90 backdrop-blur-sm shadow-lg hover:bg-white transition-colors z-10"
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="사진 새로고침"
          >
            <RefreshCw className="w-4 h-4 text-gray-700" />
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
  onTitleClick?: () => void;
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
  
  const handleChange = useCallback((field: keyof TitleStyle, value: any) => {
    const newStyle = { ...localStyle, [field]: value };
    setLocalStyle(newStyle);
    onStyleChange(newStyle);
  }, [localStyle, onStyleChange]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="absolute top-full left-1/2 transform -translate-x-1/2 mt-4 z-50 bg-white rounded-xl shadow-2xl p-6"
      style={{
        width: '90%',
        maxWidth: '400px',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="닫기"
      >
        <X className="w-5 h-5 text-gray-500" />
      </button>
      
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          디자인 수정
        </h3>
        
        {/* 글자 내용 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            글자 내용
          </label>
          <input
            type="text"
            value={localStyle.content}
            onChange={(e) => handleChange('content', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="타이틀 텍스트"
          />
        </div>
        
        {/* 색상 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            색상
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={localStyle.color}
              onChange={(e) => handleChange('color', e.target.value)}
              className="w-12 h-12 rounded-lg border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={localStyle.color}
              onChange={(e) => handleChange('color', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="#9333ea"
            />
          </div>
        </div>
        
        {/* 폰트 크기 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            폰트 크기: {localStyle.fontSize}px
          </label>
          <input
            type="range"
            min="24"
            max="72"
            value={localStyle.fontSize}
            onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>
        
        {/* 폰트 두께 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            폰트 두께
          </label>
          <select
            value={localStyle.fontWeight}
            onChange={(e) => handleChange('fontWeight', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            자간: {localStyle.letterSpacing}px
          </label>
          <input
            type="range"
            min="-2"
            max="10"
            step="0.5"
            value={localStyle.letterSpacing}
            onChange={(e) => handleChange('letterSpacing', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
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
    // onTitleClick이 있으면 먼저 호출 (가족 이름 수정 모달)
    if (onTitleClick) {
      onTitleClick();
    } else {
      // onTitleClick이 없으면 디자인 에디터 표시
      setShowEditor(!showEditor);
    }
  }, [onTitleClick, showEditor]);
  
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

        {/* 집 아이콘 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-2 relative z-20 mt-4"
        >
          <div 
            className="leading-none"
            style={{
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
              fontSize: '80px'
            }}
          >
            🏠
          </div>
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
        
        {/* 디자인 에디터 (타이틀 클릭 시 표시) */}
        <AnimatePresence>
          {showEditor && (
            <DesignEditor
              titleStyle={titleStyle}
              onStyleChange={handleStyleChange}
              onClose={() => setShowEditor(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TitlePage;
export { CONSTANTS };
export type { TitleStyle };
