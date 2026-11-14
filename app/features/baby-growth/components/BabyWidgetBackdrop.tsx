'use client';

/** 우리아이 위젯 수채 바탕. 클릭은 통과시킨다. */
export function BabyWidgetBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-8 top-6 h-28 w-28 rounded-full bg-pink-200/80 blur-2xl" />
      <div className="absolute -right-6 -top-4 h-32 w-36 rounded-full bg-sky-200/80 blur-2xl" />
      <div className="absolute bottom-6 left-2 h-24 w-32 rounded-full bg-blue-200/70 blur-2xl" />
      <div className="absolute -bottom-2 right-4 h-20 w-24 rounded-full bg-rose-200/80 blur-2xl" />
      <div className="absolute left-1/3 top-1/2 h-16 w-20 rounded-full bg-amber-100/80 blur-xl" />
    </div>
  );
}

export function BabyWidgetStickers() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      <Rattle className="absolute right-[38%] top-1 h-10 w-8 opacity-90" />
      <Blanket className="absolute right-[5.75rem] top-2 h-11 w-12 opacity-95" />
      <Rattle className="absolute -left-1 top-[46%] h-12 w-9 -rotate-12 opacity-90" />
      <Hands className="absolute left-[34%] top-[36%] h-10 w-12 opacity-80" />
      <SunCloud className="absolute right-[4%] top-[40%] h-14 w-16 opacity-90" />
      <Blocks className="absolute bottom-[16%] right-1 h-12 w-12 opacity-95" />
      <WingHeart className="absolute bottom-1 right-2 h-8 w-10 opacity-90" />
    </div>
  );
}

function Rattle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 64" className={className}>
      <ellipse cx="24" cy="18" rx="14" ry="13" fill="#f7c5d4" stroke="#e7a8ba" strokeWidth="1.4" />
      <circle cx="18" cy="14" r="1.4" fill="#fff" />
      <circle cx="27" cy="12" r="1.1" fill="#fff" />
      <rect x="21" y="30" width="6" height="16" rx="3" fill="#f3d2b5" stroke="#e2b894" />
      <circle cx="24" cy="50" r="5" fill="#f6e2cf" stroke="#e2b894" />
    </svg>
  );
}

function Blanket({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 64" className={className}>
      <path d="M8 14c8-8 48-8 56 2 4 18-2 36-16 40-18 4-40-6-40-22 0-8 0-16 0-20z" fill="#d7ecf8" stroke="#b7d4ea" />
      <path d="M14 20c10 4 18 2 24-4M18 30c8 3 16 2 22-3M16 40c8 2 14 1 20-2" fill="none" stroke="#f7e7a2" strokeWidth="1.6" />
      <path d="M22 18l1.2 2.4 2.6.2-2 1.7.6 2.5-2.4-1.4-2.4 1.4.6-2.5-2-1.7 2.6-.2z" fill="#f6e27a" />
      <path d="M40 24l1 2 2.2.2-1.7 1.4.5 2.1-2-1.2-2 1.2.5-2.1-1.7-1.4 2.2-.2z" fill="#f6e27a" />
      <path d="M34 36l.9 1.8 2 .1-1.5 1.3.5 1.9-1.9-1.1-1.9 1.1.5-1.9-1.5-1.3 2-.1z" fill="#f6e27a" />
    </svg>
  );
}

function Hands({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className}>
      <path d="M8 22c2-8 10-12 16-8 2 6 1 12-2 16-4 2-12 0-14-8z" fill="#f8d7c4" stroke="#e7b79f" />
      <path d="M40 20c6-6 14-4 16 2 2 8-4 14-12 12-6-1-8-8-4-14z" fill="#f8d7c4" stroke="#e7b79f" />
      <path d="M24 18c4 2 8 2 12 0" fill="none" stroke="#e7b79f" strokeWidth="1.2" />
    </svg>
  );
}

function SunCloud({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 56" className={className}>
      <circle cx="28" cy="18" r="10" fill="#ffe08a" stroke="#f2c85a" />
      <path d="M28 4v3M28 29v3M14 18h3M39 18h3M17 8l2 2M37 26l2 2M17 28l2-2M37 10l2-2" stroke="#f2c85a" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 30c2 2 2 4 0 4" fill="none" stroke="#7eb6d6" strokeWidth="1.2" />
      <ellipse cx="40" cy="40" rx="18" ry="10" fill="#e7f4fb" stroke="#c5dfef" />
      <ellipse cx="28" cy="42" rx="10" ry="8" fill="#f4fbfe" stroke="#c5dfef" />
      <path d="M34 38c1 2 1 3-1 4M44 36c1 2 0 3-1 4" stroke="#7eb6d6" strokeWidth="1" fill="none" />
    </svg>
  );
}

function Blocks({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 56" className={className}>
      <rect x="6" y="26" width="20" height="18" rx="3" fill="#f7b7c8" stroke="#e59aaf" transform="rotate(-8 16 35)" />
      <rect x="22" y="16" width="18" height="18" rx="3" fill="#b9ddf5" stroke="#8ec0e4" />
      <rect x="30" y="30" width="16" height="16" rx="3" fill="#f6e7a8" stroke="#e2cc78" />
    </svg>
  );
}

function WingHeart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 36" className={className}>
      <path d="M8 16c4-8 14-6 14 2 0-8 10-10 14-2-2 6-8 10-14 14C16 24 10 20 8 16z" fill="#f3a8b8" />
      <path d="M6 18c-6-2-8 4-4 7 3 1 6-1 8-3M50 18c6-2 8 4 4 7-3 1-6-1-8-3" fill="#f7e7ef" stroke="#e7c3d2" />
    </svg>
  );
}
