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

/** 프로필 영역 스티커(담요만). 딸랑이는 성장기록 버튼을 가려서 제거. */
export function BabyWidgetStickers() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-visible" aria-hidden>
      <Sticker src="/baby-widget/blanket.png?v=5" className="absolute left-[62%] top-[2.5%] w-[13%]" />
    </div>
  );
}

export function Sticker({ src, className }: { src: string; className: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" draggable={false} className={`${className} h-auto max-w-none object-contain`} />
  );
}
