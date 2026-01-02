'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import Image from 'next/image';

// 상수 분리 - 텍스트 내용 관리
const CONSTANTS = {
  TITLE: 'Ellena Family Hub',
  DEFAULT_TITLE: 'Ellena Family Hub',
} as const;

// TitleText 컴포넌트 - 타이틀 텍스트 부분 분리
interface TitleTextProps {
  title: string;
  onTitleClick?: () => void;
}

const TitleText: React.FC<TitleTextProps> = ({ title, onTitleClick }) => {
  return (
    <motion.h1
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      onClick={onTitleClick}
      className="text-4xl md:text-5xl font-bold text-center cursor-pointer select-none mb-6"
      style={{
        background: 'linear-gradient(to right, #9333ea, #2563eb, #ec4899)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        color: '#9333ea', // fallback color
      }}
    >
      {title || CONSTANTS.DEFAULT_TITLE}
    </motion.h1>
  );
};

// 가족 일러스트 컴포넌트 - public/family-illustration.png 이미지 파일 사용
const FamilyIllustration: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
      className="flex items-center justify-center my-4 w-full"
      style={{
        padding: '0 16px',
      }}
    >
      <div
        className="relative"
        style={{
          width: '100%',
          maxWidth: '240px',
          height: 'auto',
          aspectRatio: '2 / 1',
        }}
      >
        <Image
          src="/family-illustration.png"
          alt="Family illustration - Mom, child, and dad holding hands"
          fill
          style={{
            objectFit: 'contain',
            objectPosition: 'center',
            filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.08))',
          }}
          priority
          sizes="(max-width: 768px) 240px, 280px"
          unoptimized={true}
        />
      </div>
    </motion.div>
  );
};

// 월계수 관 장식 컴포넌트
const LaurelWreath: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.9 }}
      className="relative w-full max-w-xs md:max-w-md mx-auto mt-6"
    >
      <svg
        viewBox="0 0 300 80"
        className="w-full h-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 왼쪽 가지 */}
        <path
          d="M 30 40 Q 20 25, 40 20 Q 60 15, 80 25 Q 100 30, 120 35"
          stroke="#d4af37"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 오른쪽 가지 */}
        <path
          d="M 270 40 Q 280 25, 260 20 Q 240 15, 220 25 Q 200 30, 180 35"
          stroke="#d4af37"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 잎 장식 - 왼쪽 */}
        <ellipse cx="50" cy="22" rx="4" ry="8" fill="#8b6914" transform="rotate(-30 50 22)" />
        <ellipse cx="70" cy="18" rx="4" ry="8" fill="#8b6914" transform="rotate(20 70 18)" />
        <ellipse cx="90" cy="25" rx="4" ry="8" fill="#8b6914" transform="rotate(-15 90 25)" />
        {/* 잎 장식 - 오른쪽 */}
        <ellipse cx="210" cy="25" rx="4" ry="8" fill="#8b6914" transform="rotate(15 210 25)" />
        <ellipse cx="230" cy="18" rx="4" ry="8" fill="#8b6914" transform="rotate(-20 230 18)" />
        <ellipse cx="250" cy="22" rx="4" ry="8" fill="#8b6914" transform="rotate(30 250 22)" />
        {/* 중앙 연결선 */}
        <path
          d="M 120 35 L 180 35"
          stroke="#d4af37"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
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
}

const TitlePage: React.FC<TitlePageProps> = ({ title, onTitleClick }) => {
  return (
    <div 
      className="relative w-full min-h-[380px] md:min-h-[450px] flex flex-col items-center justify-center overflow-visible rounded-2xl mb-4"
      style={{
        background: 'linear-gradient(to bottom right, #e0f2fe 0%, #e9d5ff 50%, #fce7f3 100%)',
        paddingTop: '12px'
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
      <div className="relative z-20 flex flex-col items-center justify-center px-4 pt-8 pb-6 w-full min-h-[380px]">
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
          className="mb-6 relative z-20 mt-4"
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

        {/* 타이틀 텍스트 */}
        <TitleText title={title || CONSTANTS.TITLE} onTitleClick={onTitleClick} />

        {/* 가족 일러스트 */}
        <FamilyIllustration />

        {/* 월계수 관 장식 */}
        <LaurelWreath />
      </div>
    </div>
  );
};

export default TitlePage;
export { CONSTANTS };

