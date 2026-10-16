/** Kids 캘린더 일정 칸 PNG 스티커. 스키마/권한과 무관. */

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
