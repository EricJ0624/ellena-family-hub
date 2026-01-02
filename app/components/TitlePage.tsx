'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';

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

// 가족 일러스트 컴포넌트 - 전신 캐릭터가 손을 잡고 있는 SVG
const FamilyIllustration: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
      className="flex items-center justify-center my-4 w-full max-w-md mx-auto"
    >
      <svg
        viewBox="0 0 400 200"
        className="w-full h-auto max-h-48 md:max-h-64"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 여자아이 (왼쪽) */}
        <g transform="translate(50, 50)">
          {/* 머리 */}
          <circle cx="30" cy="20" r="18" fill="#fdbcb4" />
          {/* 머리카락 */}
          <path
            d="M 15 20 Q 12 10, 20 8 Q 30 6, 40 8 Q 48 10, 45 20 Q 42 25, 30 25 Q 18 25, 15 20"
            fill="#f4a261"
          />
          {/* 눈 */}
          <circle cx="25" cy="18" r="2" fill="#2a2a2a" />
          <circle cx="35" cy="18" r="2" fill="#2a2a2a" />
          {/* 입 */}
          <path d="M 25 24 Q 30 26, 35 24" stroke="#2a2a2a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          {/* 몸통 */}
          <rect x="20" y="38" width="20" height="30" rx="5" fill="#ff6b9d" />
          {/* 팔 (왼쪽 - 손을 잡고 있음) */}
          <ellipse cx="15" cy="50" rx="8" ry="15" fill="#fdbcb4" transform="rotate(-20 15 50)" />
          {/* 팔 (오른쪽 - 손을 잡고 있음) */}
          <ellipse cx="45" cy="50" rx="8" ry="15" fill="#fdbcb4" transform="rotate(20 45 50)" />
          {/* 다리 */}
          <rect x="22" y="68" width="6" height="25" rx="3" fill="#4a90e2" />
          <rect x="32" y="68" width="6" height="25" rx="3" fill="#4a90e2" />
          {/* 신발 */}
          <ellipse cx="25" cy="96" rx="5" ry="3" fill="#2a2a2a" />
          <ellipse cx="35" cy="96" rx="5" ry="3" fill="#2a2a2a" />
        </g>

        {/* 손 잡기 (왼쪽) */}
        <g transform="translate(120, 80)">
          <circle cx="0" cy="0" r="8" fill="#fdbcb4" />
          <circle cx="15" cy="0" r="8" fill="#fdbcb4" />
          <path
            d="M 8 0 Q 11.5 0, 15 0"
            stroke="#fdbcb4"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
        </g>

        {/* 엄마 (중앙) */}
        <g transform="translate(150, 30)">
          {/* 머리 */}
          <circle cx="50" cy="25" r="22" fill="#fdbcb4" />
          {/* 머리카락 */}
          <path
            d="M 30 25 Q 25 10, 40 5 Q 60 0, 70 5 Q 85 10, 70 25 Q 65 30, 50 30 Q 35 30, 30 25"
            fill="#8b4513"
          />
          {/* 눈 */}
          <circle cx="45" cy="23" r="2.5" fill="#2a2a2a" />
          <circle cx="55" cy="23" r="2.5" fill="#2a2a2a" />
          {/* 입 */}
          <path d="M 45 30 Q 50 32, 55 30" stroke="#2a2a2a" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* 몸통 */}
          <rect x="40" y="47" width="20" height="40" rx="6" fill="#e63946" />
          {/* 팔 (왼쪽 - 손을 잡고 있음) */}
          <ellipse cx="30" cy="60" rx="10" ry="18" fill="#fdbcb4" transform="rotate(-25 30 60)" />
          {/* 팔 (오른쪽 - 손을 잡고 있음) */}
          <ellipse cx="70" cy="60" rx="10" ry="18" fill="#fdbcb4" transform="rotate(25 70 60)" />
          {/* 다리 */}
          <rect x="42" y="87" width="7" height="30" rx="3.5" fill="#264653" />
          <rect x="51" y="87" width="7" height="30" rx="3.5" fill="#264653" />
          {/* 신발 */}
          <ellipse cx="45.5" cy="120" rx="6" ry="4" fill="#2a2a2a" />
          <ellipse cx="54.5" cy="120" rx="6" ry="4" fill="#2a2a2a" />
        </g>

        {/* 손 잡기 (오른쪽) */}
        <g transform="translate(280, 80)">
          <circle cx="0" cy="0" r="8" fill="#fdbcb4" />
          <circle cx="15" cy="0" r="8" fill="#fdbcb4" />
          <path
            d="M 8 0 Q 11.5 0, 15 0"
            stroke="#fdbcb4"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
        </g>

        {/* 아빠 (오른쪽) */}
        <g transform="translate(310, 40)">
          {/* 머리 */}
          <circle cx="40" cy="20" r="20" fill="#fdbcb4" />
          {/* 머리카락 */}
          <path
            d="M 22 20 Q 20 8, 30 5 Q 50 2, 58 5 Q 68 8, 58 20 Q 55 25, 40 25 Q 25 25, 22 20"
            fill="#2a2a2a"
          />
          {/* 눈 */}
          <circle cx="35" cy="18" r="2.5" fill="#2a2a2a" />
          <circle cx="45" cy="18" r="2.5" fill="#2a2a2a" />
          {/* 수염 */}
          <path
            d="M 32 28 Q 35 30, 40 30 Q 45 30, 48 28"
            stroke="#2a2a2a"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          {/* 입 */}
          <path d="M 35 32 Q 40 34, 45 32" stroke="#2a2a2a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          {/* 몸통 */}
          <rect x="30" y="40" width="20" height="45" rx="5" fill="#457b9d" />
          {/* 팔 (왼쪽 - 손을 잡고 있음) */}
          <ellipse cx="20" cy="55" rx="10" ry="18" fill="#fdbcb4" transform="rotate(-25 20 55)" />
          {/* 팔 (오른쪽) */}
          <ellipse cx="60" cy="55" rx="10" ry="18" fill="#fdbcb4" transform="rotate(25 60 55)" />
          {/* 다리 */}
          <rect x="32" y="85" width="7" height="32" rx="3.5" fill="#1d3557" />
          <rect x="41" y="85" width="7" height="32" rx="3.5" fill="#1d3557" />
          {/* 신발 */}
          <ellipse cx="35.5" cy="120" rx="6" ry="4" fill="#2a2a2a" />
          <ellipse cx="44.5" cy="120" rx="6" ry="4" fill="#2a2a2a" />
        </g>
      </svg>
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
      className="relative w-full min-h-[450px] md:min-h-[550px] flex flex-col items-center justify-center overflow-hidden rounded-2xl mb-4"
      style={{
        background: 'linear-gradient(to bottom right, #e0f2fe 0%, #e9d5ff 50%, #fce7f3 100%)',
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
      <div className="relative z-20 flex flex-col items-center justify-center px-4 py-8 w-full min-h-[450px]">
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
          className="mb-6 relative z-20"
        >
          <div 
            className="leading-none"
            style={{
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
              fontSize: '100px'
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

