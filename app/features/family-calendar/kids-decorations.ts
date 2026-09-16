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

/** 생일 마커: 일반/존댓말·각 언어 동의어 (제목에 포함되면 congrats 프레임) */
const BIRTHDAY_PATTERN =
  /생일|생신|birthday|bday|cake|케이크|誕生日|バースデー|生日|寿辰|壽辰|诞辰|誕辰|cumpleaños|cumpleanos|cumple|anniversaire|geburtstag|compleanno|anivers[aá]rio/;

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
 * 위젯 가장자리에 분산 배치 (한 모서리에 몰지 않음).
 * 날짜 숫자와 겹치면 일정처럼 보이므로 그리드 안쪽은 피하고,
 * Add Event 버튼 위(앞) 겹침은 허용.
 */
const SAFE_SLOTS: IdleSlot[] = [
  // 타이틀(FAMILY CALENDAR)과 우측 끝 사이 빈 구간 — 항상 2개
  { size: 'sm', className: 'top-[1.5cqmin] left-[61cqmin] w-[5.6cqmin] rotate-[12deg]' },
  { size: 'md', className: 'top-[2.2cqmin] left-[71cqmin] w-[7cqmin] -rotate-10' },
  // 우측 상단 끝
  { size: 'md', className: 'top-[1.2cqmin] right-[0.8cqmin] w-[7.2cqmin] rotate-[-14deg]' },
  { size: 'sm', className: 'top-[10.5cqmin] right-[0.5cqmin] w-[5.2cqmin] rotate-[8deg]' },
  // 좌측 — 높이 다르게 분산
  { size: 'lg', className: 'top-[22cqmin] left-[0] w-[8.4cqmin] rotate-[-14deg]' },
  { size: 'md', className: 'top-[40cqmin] left-[0] w-[7cqmin] rotate-[10deg]' },
  { size: 'sm', className: 'top-[58cqmin] left-[0.1cqmin] w-[5.4cqmin] -rotate-8' },
  { size: 'md', className: 'top-[68cqmin] left-[0] w-[6.8cqmin] rotate-[6deg]' },
  // 우측 — 좌측과 다른 높이
  { size: 'md', className: 'top-[26cqmin] right-[0] w-[7cqmin] rotate-[14deg]' },
  { size: 'lg', className: 'top-[46cqmin] right-[0] w-[8.4cqmin] -rotate-8' },
  { size: 'sm', className: 'top-[64cqmin] right-[0.1cqmin] w-[5.4cqmin] rotate-10' },
  // 하단 Add Event 위 — 좌·중·우로 분산
  { size: 'lg', className: 'bottom-[0] left-[8cqmin] w-[9.2cqmin] rotate-[-8deg]' },
  { size: 'md', className: 'bottom-[0.3cqmin] left-[42cqmin] w-[7.2cqmin] rotate-[12deg]' },
  { size: 'md', className: 'bottom-[0] right-[2cqmin] w-[7.6cqmin] -rotate-10' },
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
