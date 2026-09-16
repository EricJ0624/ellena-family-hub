/** Kids 캘린더 평상시 장식 자리 + 일정 칸 PNG 스티커. 스키마/권한과 무관. */

const KIDS_STICKER = {
  book: '/family-calendar/emojis/book.png',
  mic: '/family-calendar/emojis/mic.png',
  stroller: '/family-calendar/emojis/stroller.png',
  bicycle: '/family-calendar/emojis/bicycle.png',
  dog: '/family-calendar/emojis/dog.png',
  house: '/family-calendar/emojis/house.png',
  family: '/family-calendar/emojis/family.png',
  briefcase: '/family-calendar/emojis/briefcase.png',
  palette: '/family-calendar/emojis/palette.png',
  ghost: '/family-calendar/emojis/ghost.png',
  firework: '/family-calendar/emojis/firework.png',
  star: '/family-calendar/emojis/star.png',
} as const;

const KIDS_CONGRATS = [
  '/family-calendar/emojis/congrats-1.png',
  '/family-calendar/emojis/congrats-2.png',
  '/family-calendar/emojis/congrats-3.png',
] as const;

const BIRTHDAY_PATTERN = /생일|birthday|cake|케이크/;

function pickCongratsSrc(seedKey: string): string {
  let seed = 0;
  for (let i = 0; i < seedKey.length; i += 1) {
    seed = (Math.imul(seed, 31) + seedKey.charCodeAt(i)) | 0;
  }
  return KIDS_CONGRATS[Math.abs(seed) % KIDS_CONGRATS.length];
}

const STICKER_RULES: { src: string; pattern: RegExp }[] = [
  { src: KIDS_STICKER.book, pattern: /학교|school|수업|class|학원|책|book/ },
  { src: KIDS_STICKER.mic, pattern: /음악|music|concert|콘서트|노래|mic/ },
  { src: KIDS_STICKER.stroller, pattern: /아기|baby|유모차|stroller/ },
  { src: KIDS_STICKER.bicycle, pattern: /운동|gym|sport|축구|야구|수영|자전거|bicycle/ },
  { src: KIDS_STICKER.dog, pattern: /강아지|dog|반려/ },
  { src: KIDS_STICKER.house, pattern: /집|home|house|이사/ },
  { src: KIDS_STICKER.family, pattern: /가족|family/ },
  { src: KIDS_STICKER.briefcase, pattern: /회사|work|회의|미팅|출장/ },
  { src: KIDS_STICKER.palette, pattern: /그림|미술|art|paint|팔레트/ },
  { src: KIDS_STICKER.ghost, pattern: /할로윈|halloween|유령|ghost/ },
  { src: KIDS_STICKER.firework, pattern: /파티|party|festival|축제/ },
];

export function kidsStickerFromTitles(titles: string[], seedKey = ''): string {
  const text = titles.join(' ').toLowerCase();
  if (BIRTHDAY_PATTERN.test(text)) return pickCongratsSrc(seedKey || text);
  for (const rule of STICKER_RULES) {
    if (rule.pattern.test(text)) return rule.src;
  }
  return KIDS_STICKER.star;
}

export function isKidsCongratsFrame(src: string | null | undefined): boolean {
  return !!src && (KIDS_CONGRATS as readonly string[]).includes(src);
}

export function kidsCongratsVariant(src: string): '1' | '2' | '3' | null {
  if (src.endsWith('congrats-1.png')) return '1';
  if (src.endsWith('congrats-2.png')) return '2';
  if (src.endsWith('congrats-3.png')) return '3';
  return null;
}

type SlotSize = 'sm' | 'md' | 'lg';

type IdleSlot = {
  size: SlotSize;
  className: string;
};

type IdleDeco = {
  src: string;
  size: SlotSize;
};

const IDLE_DECOS: IdleDeco[] = [
  { src: '/family-calendar/emojis/rainbow.png', size: 'lg' },
  { src: '/family-calendar/emojis/firework.png', size: 'md' },
  { src: '/family-calendar/emojis/family.png', size: 'md' },
  { src: '/family-calendar/emojis/dog.png', size: 'sm' },
  { src: '/family-calendar/emojis/firework-2.png', size: 'md' },
  { src: '/family-calendar/emojis/earth.png', size: 'sm' },
  { src: '/family-calendar/emojis/stroller.png', size: 'md' },
  { src: '/family-calendar/emojis/planet.png', size: 'md' },
  { src: '/family-calendar/emojis/shooting-star.png', size: 'lg' },
  { src: '/family-calendar/emojis/shooting-star.png', size: 'lg' },
  { src: '/family-calendar/emojis/star.png', size: 'sm' },
  { src: '/family-calendar/emojis/star.png', size: 'sm' },
  { src: '/family-calendar/emojis/house.png', size: 'md' },
];

/**
 * 위젯 가장자리(패딩·모서리)만 사용.
 * 날짜 그리드·요일·숫자와 겹치면 일정 스티커처럼 보이므로 금지.
 * 섹션 패딩 ≈ 좌우 6cqmin / 상하 5cqmin → 슬롯 width+inset 이 그 안쪽에 머물게.
 */
const SAFE_SLOTS: IdleSlot[] = [
  // 타이틀 오른쪽(글자·연월과 분리)
  { size: 'sm', className: 'top-[2.4cqmin] right-[18cqmin] w-[3.2cqmin] rotate-[12deg]' },
  { size: 'md', className: 'top-[2.8cqmin] right-[9cqmin] w-[4.6cqmin] -rotate-10' },
  { size: 'sm', className: 'top-[6.5cqmin] right-[3.2cqmin] w-[3.4cqmin] rotate-[8deg]' },
  { size: 'md', className: 'top-[1.8cqmin] right-[1.6cqmin] w-[4.8cqmin] rotate-[-16deg]' },
  // 좌·우 여백 — 좁게 유지해 날짜 칸과 겹치지 않게 (회전 여유 포함)
  { size: 'lg', className: 'top-[28cqmin] left-[0.15cqmin] w-[3.5cqmin] rotate-[-12deg]' },
  { size: 'md', className: 'top-[46cqmin] left-[0.2cqmin] w-[3.3cqmin] rotate-[8deg]' },
  { size: 'sm', className: 'bottom-[3cqmin] left-[0.3cqmin] w-[3cqmin] -rotate-8' },
  { size: 'md', className: 'top-[32cqmin] right-[0.15cqmin] w-[3.4cqmin] rotate-[14deg]' },
  { size: 'lg', className: 'top-[50cqmin] right-[0.2cqmin] w-[3.6cqmin] -rotate-6' },
  { size: 'sm', className: 'bottom-[3.2cqmin] right-[0.3cqmin] w-[3cqmin] rotate-10' },
  // Add Event 좌·우 — 버튼과 겹쳐도 버튼 z-index가 위
  { size: 'lg', className: 'bottom-[1.5cqmin] left-[6cqmin] w-[5cqmin] rotate-[-8deg]' },
  { size: 'md', className: 'bottom-[1.8cqmin] left-[16cqmin] w-[4cqmin] rotate-[12deg]' },
  { size: 'md', className: 'bottom-[1.5cqmin] right-[6cqmin] w-[4.6cqmin] -rotate-8' },
];

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const arr = items.slice();
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(s ^ (s >>> 16), 0x45d9f3b) + 0x6d2b79f5) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function layoutKidsIdleDecos(year: number, month: number): { src: string; className: string }[] {
  const seed = year * 12 + month + 17;
  const pool = {
    sm: seededShuffle(SAFE_SLOTS.filter((slot) => slot.size === 'sm'), seed),
    md: seededShuffle(SAFE_SLOTS.filter((slot) => slot.size === 'md'), seed + 31),
    lg: seededShuffle(SAFE_SLOTS.filter((slot) => slot.size === 'lg'), seed + 53),
  };
  const used: Record<SlotSize, number> = { sm: 0, md: 0, lg: 0 };
  return IDLE_DECOS.map((deco) => {
    const slot = pool[deco.size][used[deco.size]];
    used[deco.size] += 1;
    return slot ? { src: deco.src, className: slot.className } : null;
  }).filter((item): item is { src: string; className: string } => item != null);
}
