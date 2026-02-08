'use client';

import React from 'react';

// 프레임 스타일 타입 정의
export type FrameStyle = 'baroque' | 'modern' | 'vintage' | 'minimal' | 'ornate';

export interface FrameConfig {
  id: FrameStyle;
  name: string;
  description: string;
  color: string;
}

// 프레임 설정 목록
export const FRAME_CONFIGS: FrameConfig[] = [
  {
    id: 'baroque',
    name: '바로크',
    description: '화려하고 장식적인 클래식 프레임',
    color: '#5d2a1f',
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
    description: '깔끔하고 현대적인 프레임',
    color: '#4a4a4a',
  },
  {
    id: 'minimal',
    name: '미니멀',
    description: '심플하고 세련된 프레임',
    color: '#8b7355',
  },
];

interface PhotoFrameSVGProps {
  frameStyle: FrameStyle;
  color?: string;
  width?: number;
  height?: number;
}

// 바로크 스타일 프레임 SVG
const BaroqueFrame: React.FC<{ color: string }> = ({ color }) => {
  return (
    <svg
      viewBox="0 0 400 300"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <defs>
        {/* 나무 질감 그라데이션 */}
        <linearGradient id="baroqueWood" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="25%" stopColor="#4e342e" stopOpacity="1" />
          <stop offset="50%" stopColor={color} stopOpacity="1" />
          <stop offset="75%" stopColor="#5d4037" stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
        
        {/* 하이라이트 그라데이션 */}
        <linearGradient id="baroqueHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </linearGradient>

        {/* 장식 패턴 */}
        <pattern id="baroquePattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill="rgba(0,0,0,0.05)" />
          <line x1="0" y1="10" x2="20" y2="10" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* 외곽 프레임 */}
      <rect
        x="0"
        y="0"
        width="400"
        height="300"
        fill="url(#baroqueWood)"
        stroke="rgba(0,0,0,0.5)"
        strokeWidth="2"
      />
      
      {/* 나무 결 패턴 */}
      <rect x="0" y="0" width="400" height="300" fill="url(#baroquePattern)" />

      {/* 내부 테두리 (입체감) */}
      <rect
        x="15"
        y="15"
        width="370"
        height="270"
        fill="none"
        stroke="rgba(0,0,0,0.6)"
        strokeWidth="3"
      />
      
      {/* 하이라이트 */}
      <rect
        x="0"
        y="0"
        width="400"
        height="300"
        fill="url(#baroqueHighlight)"
        opacity="0.3"
      />

      {/* 모서리 장식 - 왼쪽 위 */}
      <g transform="translate(20, 20)">
        <path
          d="M 0,0 Q 10,-5 20,0 Q 15,10 20,20 Q 10,15 0,20 Q 5,10 0,0 Z"
          fill="rgba(139,69,19,0.8)"
          stroke="rgba(0,0,0,0.5)"
          strokeWidth="1"
        />
        <circle cx="10" cy="10" r="3" fill="rgba(255,215,0,0.3)" />
      </g>

      {/* 모서리 장식 - 오른쪽 위 */}
      <g transform="translate(360, 20)">
        <path
          d="M 0,0 Q 10,-5 20,0 Q 15,10 20,20 Q 10,15 0,20 Q 5,10 0,0 Z"
          fill="rgba(139,69,19,0.8)"
          stroke="rgba(0,0,0,0.5)"
          strokeWidth="1"
        />
        <circle cx="10" cy="10" r="3" fill="rgba(255,215,0,0.3)" />
      </g>

      {/* 모서리 장식 - 왼쪽 아래 */}
      <g transform="translate(20, 260)">
        <path
          d="M 0,0 Q 10,-5 20,0 Q 15,10 20,20 Q 10,15 0,20 Q 5,10 0,0 Z"
          fill="rgba(139,69,19,0.8)"
          stroke="rgba(0,0,0,0.5)"
          strokeWidth="1"
        />
        <circle cx="10" cy="10" r="3" fill="rgba(255,215,0,0.3)" />
      </g>

      {/* 모서리 장식 - 오른쪽 아래 */}
      <g transform="translate(360, 260)">
        <path
          d="M 0,0 Q 10,-5 20,0 Q 15,10 20,20 Q 10,15 0,20 Q 5,10 0,0 Z"
          fill="rgba(139,69,19,0.8)"
          stroke="rgba(0,0,0,0.5)"
          strokeWidth="1"
        />
        <circle cx="10" cy="10" r="3" fill="rgba(255,215,0,0.3)" />
      </g>

      {/* 상단 중앙 장식 */}
      <g transform="translate(190, 10)">
        <ellipse cx="10" cy="5" rx="15" ry="8" fill="rgba(139,69,19,0.8)" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
        <path d="M 5,3 Q 10,0 15,3" stroke="rgba(255,215,0,0.4)" strokeWidth="1" fill="none" />
      </g>

      {/* 하단 중앙 장식 */}
      <g transform="translate(190, 285)">
        <ellipse cx="10" cy="5" rx="15" ry="8" fill="rgba(139,69,19,0.8)" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
        <path d="M 5,7 Q 10,10 15,7" stroke="rgba(255,215,0,0.4)" strokeWidth="1" fill="none" />
      </g>
    </svg>
  );
};

// 오네이트 스타일 프레임 SVG
const OrnateFrame: React.FC<{ color: string }> = ({ color }) => {
  return (
    <svg
      viewBox="0 0 400 300"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <defs>
        <linearGradient id="ornateWood" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} />
          <stop offset="50%" stopColor="#2a1208" />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
        
        <radialGradient id="ornateGlow">
          <stop offset="0%" stopColor="rgba(255,215,0,0.4)" />
          <stop offset="100%" stopColor="rgba(139,69,19,0)" />
        </radialGradient>
      </defs>

      {/* 외곽 프레임 - 두꺼운 테두리 */}
      <rect x="0" y="0" width="400" height="300" fill="url(#ornateWood)" />
      
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
          <circle cx="12" cy="12" r="5" fill="url(#ornateGlow)" />
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

// 빈티지 스타일 프레임 SVG
const VintageFrame: React.FC<{ color: string }> = ({ color }) => {
  return (
    <svg
      viewBox="0 0 400 300"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <defs>
        <linearGradient id="vintageWood" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} />
          <stop offset="50%" stopColor="#8b6f47" />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="400" height="300" fill="url(#vintageWood)" />
      <rect x="10" y="10" width="380" height="280" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="2" />
      <rect x="15" y="15" width="370" height="270" fill="none" stroke="rgba(139,69,19,0.6)" strokeWidth="1" />

      {/* 빈티지 모서리 */}
      {[
        { x: 20, y: 20 },
        { x: 370, y: 20 },
        { x: 20, y: 270 },
        { x: 370, y: 270 },
      ].map((corner, i) => (
        <circle key={i} cx={corner.x} cy={corner.y} r="4" fill="rgba(139,69,19,0.8)" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
      ))}
    </svg>
  );
};

// 모던 스타일 프레임 SVG
const ModernFrame: React.FC<{ color: string }> = ({ color }) => {
  return (
    <svg
      viewBox="0 0 400 300"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <defs>
        <linearGradient id="modernGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor="#2a2a2a" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="400" height="300" fill="url(#modernGradient)" />
      <rect x="12" y="12" width="376" height="276" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <rect x="18" y="18" width="364" height="264" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2" />
    </svg>
  );
};

// 미니멀 스타일 프레임 SVG
const MinimalFrame: React.FC<{ color: string }> = ({ color }) => {
  return (
    <svg
      viewBox="0 0 400 300"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <rect x="0" y="0" width="400" height="300" fill={color} />
      <rect x="15" y="15" width="370" height="270" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
    </svg>
  );
};

// 메인 프레임 컴포넌트
export const PhotoFrameSVG: React.FC<PhotoFrameSVGProps> = ({
  frameStyle,
  color,
}) => {
  const frameConfig = FRAME_CONFIGS.find(f => f.id === frameStyle);
  const frameColor = color || frameConfig?.color || '#5d2a1f';

  const FrameComponent = {
    baroque: BaroqueFrame,
    ornate: OrnateFrame,
    vintage: VintageFrame,
    modern: ModernFrame,
    minimal: MinimalFrame,
  }[frameStyle];

  return <FrameComponent color={frameColor} />;
};
