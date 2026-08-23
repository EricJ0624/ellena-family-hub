import type {
  ImportItemKind,
  ParseItineraryImportResult,
  ParsedDayTitle,
  ParsedImportItem,
  ParsedTripMeta,
} from '@/lib/modules/travel-planner/itinerary-import-types';

let _idSeq = 0;
function nextId(): string {
  _idSeq += 1;
  return `import-${_idSeq}`;
}

const DINING_RE =
  /점심|저녁|아침|브런치|식사|맛집|카페|레스토랑|디너|런치|조식|미식|미슐랭|🍽️|dinner|lunch|breakfast|brunch|restaurant|cafe|café|meal|ceviche|lechon|dining|seafood/i;
const ACCOMMODATION_RE =
  /숙소|호텔|체크인|체크아웃|리조트|게스트하우스|펜션|🏨|airbnb|bnb|accommodation|hotel|check[\s-]?in|check[\s-]?out|lodging|resort/i;
const TRANSPORT_RE =
  /비행기|항공|공항|기차|KTX|SRT|택시|grab|uber|버스|지하철|렌터카|페리|항구|차량|이동|출발|도착|🚗|✈️|rental|flight|airport|train|taxi|transfer|ferry|→|->|➡️/i;
const ATTRACTION_RE =
  /(?:^|\s)왓\s|사원|박물관|궁|공원|랜드마크|관광|전망|야경|다이빙|스노클|와칭|투어|섬\b|포인트|temple|museum|palace|park|attraction|sightseeing|tower|market|diving|snorkel|⭐/i;

const DAY_HEADER_RE =
  /^(?:#{1,3}\s*)?(?:day\s*(\d+)|(\d+)\s*일차|第\s*(\d+)\s*天)(?:\s*[\(（]([^）)]+)[\)）])?\s*[:：]?\s*(.*)$/i;
const ISO_DAY_HEADER_RE = /^(\d{4}-\d{2}-\d{2})\s*[:：]?\s*(.*)$/;
const BULLET_RE = /^[\s]*(?:[-*•●◦]|\d+[.)])\s+/;
const ISO_DATE_RE = /(\d{4})-(\d{2})-(\d{2})/g;
const TIME_RE = /(\d{1,2}):(\d{2})/;
const DATE_RANGE_RE =
  /(\d{4}-\d{2}-\d{2})\s*[~\-–—至到]\s*(\d{4}-\d{2}-\d{2})|(\d{1,2})\/(\d{1,2})\s*[~\-–—至到]\s*(\d{1,2})\/(\d{1,2})/;
const BUDGET_RE = /(?:예산|budget|총\s*예산)[:\s]*([0-9,]+)\s*(?:원|krw|만원)?/i;
const NIGHT_DAY_RE = /(\d+)\s*박\s*(\d+)\s*일/;
const KR_MD_RE = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/;
const LABELED_LINE_RE =
  /^(?:이동|오전(?:\s*~\s*오후)?|오후|종일|이른\s*아침|아침|점심|저녁|브런치|체크인|체크아웃|추천\s*호텔|호텔|숙소|미식\s*노트|미슐랭[^:：]*노트|선정\s*이유|노트)(?:\s*\([^)]*\))?\s*[:：]/i;
const EMOJI_LABELED_RE = /^[🏨🍽️🚗✈️⭐]\s*/;
const STAYOVER_RE = /숙소\s*연박|연박|same\s*hotel|stay\s*over/i;
const REASON_RE = /^선정\s*이유\s*[:：]?\s*/i;
const DINING_NOTE_RE = /^(?:🍽️\s*)?(?:미슐랭[^:：]*|미식)\s*노트\s*[:：]\s*/i;
const HOTEL_LABEL_RE = /^(?:🏨\s*)?(?:추천\s*)?호텔(?:\s*\([^)]*\))?\s*[:：]\s*/i;
const TIME_OF_DAY_LABEL_RE =
  /^(?:이동|오전(?:\s*~\s*오후)?|오후|종일|이른\s*아침|아침|점심|저녁)\s*[:：]\s*/i;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toIsoDate(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function addDays(iso: string, days: number): string {
  const dt = new Date(`${iso}T12:00:00`);
  dt.setDate(dt.getDate() + days);
  return toIsoDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

function normalizeTime(h: number, m: number): string {
  return `${pad2(Math.min(23, Math.max(0, h)))}:${pad2(Math.min(59, Math.max(0, m)))}`;
}

function extractTime(line: string): { time: string | null; rest: string } {
  const m = line.match(TIME_RE);
  if (!m) return { time: null, rest: line };
  const time = normalizeTime(Number(m[1]), Number(m[2]));
  const rest = line.replace(m[0], '').replace(/^[\s:：-]+/, '').trim();
  return { time, rest };
}

function stripBullet(line: string): string {
  return line.replace(BULLET_RE, '').trim();
}

function parseKoreanMonthDay(text: string, year: number): string | null {
  const m = text.match(KR_MD_RE);
  if (!m) return null;
  return toIsoDate(year, Number(m[1]), Number(m[2]));
}

function shortTitle(text: string, maxLen = 72): string {
  let t = text.trim().replace(/\s+/g, ' ');
  if (!t) return t;
  const cut = t.search(/[.。!?！？]/);
  if (cut > 12 && cut < maxLen) t = t.slice(0, cut).trim();
  if (t.length > maxLen) t = `${t.slice(0, maxLen - 1).trim()}…`;
  return t;
}

function splitTitleDescription(raw: string): { title: string; description: string | null } {
  const t = raw.trim();
  if (!t) return { title: '', description: null };
  const labeled = t.match(/^([^:：]{1,24})[:：]\s*(.+)$/);
  if (labeled && !/https?/i.test(labeled[1])) {
    const label = labeled[1].trim();
    const body = labeled[2].trim();
    if (TIME_OF_DAY_LABEL_RE.test(`${label}:`) || /이동|호텔|숙소|미식|미슐랭|선정/i.test(label)) {
      return { title: shortTitle(body), description: body.length > 72 ? body : null };
    }
  }
  if (t.length <= 72) return { title: t, description: null };
  return { title: shortTitle(t), description: t };
}

function classifyLine(text: string): { kind: ImportItemKind; low_confidence: boolean } {
  const t = text.trim();
  if (!t) return { kind: 'other', low_confidence: true };

  if (HOTEL_LABEL_RE.test(t) || /^🏨/.test(t)) {
    return { kind: 'accommodation', low_confidence: false };
  }
  if (DINING_NOTE_RE.test(t) || /^🍽️/.test(t)) {
    return { kind: 'dining', low_confidence: false };
  }
  if (/^🚗|^✈️/.test(t) || TIME_OF_DAY_LABEL_RE.test(t) && TRANSPORT_RE.test(t) && !DINING_RE.test(t)) {
    if (/다이빙|스노클|와칭|투어|릴랙싱|휴식/i.test(t) && !/이동|페리|공항|항구|차량/i.test(t)) {
      return { kind: 'attraction', low_confidence: false };
    }
  }

  let dining = DINING_RE.test(t) ? 3 : 0;
  let acc = ACCOMMODATION_RE.test(t) ? 3 : 0;
  let transport = TRANSPORT_RE.test(t) ? 3 : 0;
  let attraction = ATTRACTION_RE.test(t) ? 2 : 0;

  if (/디너|dinner|크루즈|미식|미슐랭|🍽️/i.test(t)) dining += 3;
  if (/🏨|추천\s*호텔|리조트/i.test(t)) acc += 3;
  if (/^왓\s|wat\s|다이빙|스노클|⭐/i.test(t)) attraction += 3;
  if (/→|->|➡️/.test(t) && transport > 0) transport += 1;
  if (/페리|항구|공항|차량으로/i.test(t)) transport += 2;
  // 호텔+레스토랑 동시 → 호텔 라벨이면 숙소 우선
  if (/호텔|🏨|리조트/i.test(t) && /레스토랑|미식/i.test(t) && HOTEL_LABEL_RE.test(t)) {
    dining = 0;
  }
  // 조식+체크아웃 혼합 → 액티비티/기타로 (숙소 중복 방지)
  if (/체크아웃/.test(t) && /조식|스노클|다이빙|아침/.test(t)) {
    acc = 0;
    attraction += 2;
  }

  const scores: [ImportItemKind, number][] = [
    ['dining', dining],
    ['accommodation', acc],
    ['transport', transport],
    ['attraction', attraction],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  const [bestKind, bestScore] = scores[0];
  const secondScore = scores[1][1];

  if (bestScore === 0) return { kind: 'other', low_confidence: true };
  if (bestScore === secondScore) {
    // 동점이면 이모지/라벨 힌트 우선
    if (/🏨|호텔/.test(t)) return { kind: 'accommodation', low_confidence: false };
    if (/🍽️|미식|미슐랭/.test(t)) return { kind: 'dining', low_confidence: false };
    return { kind: bestKind, low_confidence: true };
  }
  return { kind: bestKind, low_confidence: false };
}

function inferTransportType(text: string): 'air' | 'train' | 'car' | 'bike' {
  if (/비행|항공|flight|airport|공항/i.test(text)) return 'air';
  if (/기차|KTX|SRT|train/i.test(text)) return 'train';
  if (/바이크|bike|자전거/i.test(text)) return 'bike';
  if (/페리|ferry|항구/i.test(text)) return 'car';
  return 'car';
}

function parseTransportEndpoints(text: string): { departure: string | null; arrival: string | null } {
  const parts = text.split(/\s*(?:→|->|➡️)\s*/);
  if (parts.length >= 2) {
    const clean = (s: string) =>
      s
        .replace(TIME_OF_DAY_LABEL_RE, '')
        .replace(TIME_RE, '')
        .replace(/^이동\s*[:：]\s*/i, '')
        .trim();
    return {
      departure: clean(parts[0]) || null,
      arrival: clean(parts[parts.length - 1]) || null,
    };
  }
  return { departure: null, arrival: null };
}

function cleanHotelName(raw: string): string {
  let name = raw
    .replace(HOTEL_LABEL_RE, '')
    .replace(/^🏨\s*/, '')
    .replace(DATE_RANGE_RE, '')
    .trim();
  name = name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  name = name.replace(/\s*(?:혹은|또는)\s+.+$/u, '').trim();
  return name || raw.trim();
}

function shouldKeepLine(trimmed: string): boolean {
  if (!trimmed) return false;
  if (BULLET_RE.test(trimmed) || TIME_RE.test(trimmed)) return true;
  if (EMOJI_LABELED_RE.test(trimmed) || LABELED_LINE_RE.test(trimmed)) return true;
  if (HOTEL_LABEL_RE.test(trimmed) || DINING_NOTE_RE.test(trimmed) || REASON_RE.test(trimmed)) {
    return true;
  }
  if (ACCOMMODATION_RE.test(trimmed) || DINING_RE.test(trimmed) || TRANSPORT_RE.test(trimmed)) {
    return true;
  }
  if (ATTRACTION_RE.test(trimmed)) return true;
  // 짧은 자유 문장도 일정으로 허용
  if (trimmed.length <= 120) return true;
  return false;
}

function extractTripMeta(lines: string[], defaultYear: number): ParsedTripMeta {
  const meta: ParsedTripMeta = {};
  const head = lines.slice(0, 12).join('\n');

  const budgetM = head.match(BUDGET_RE);
  if (budgetM) {
    const num = Number(budgetM[1].replace(/,/g, ''));
    if (!Number.isNaN(num)) meta.budget = num;
  }

  const isoDates: string[] = [];
  let m: RegExpExecArray | null;
  const isoRe = new RegExp(ISO_DATE_RE.source, 'g');
  while ((m = isoRe.exec(head)) !== null) {
    isoDates.push(m[0]);
  }

  const krDates: string[] = [];
  for (const line of lines) {
    const kr = parseKoreanMonthDay(line, defaultYear);
    if (kr) krDates.push(kr);
  }

  const allDates = [...isoDates, ...krDates].sort();
  if (allDates.length >= 1) meta.start_date = allDates[0];
  if (allDates.length >= 2) meta.end_date = allDates[allDates.length - 1];

  const nightDay = head.match(NIGHT_DAY_RE);
  if (nightDay && meta.start_date && !meta.end_date) {
    const days = Number(nightDay[2]);
    if (days > 1) meta.end_date = addDays(meta.start_date, days - 1);
  }

  const destMatch = head.match(
    /(?:^|\n)(?:.{0,40}?)(방콕|파리|도쿄|오사카|서울|부산|제주|뉴욕|런던|싱가포르|다낭|호치민|하노이|발리|세부|보홀|타이베이|홍콩|마카오|시드니|로마|바르셀로나|치앙마이|푸켓|쿠알라룸푸르|[가-힣]{2,10})\b/m,
  );
  if (destMatch?.[1]) {
    meta.destination = destMatch[1].trim();
  }

  const firstLine = lines.find((l) => {
    const t = l.trim();
    if (!t || t.length >= 80) return false;
    if (BULLET_RE.test(t) || DAY_HEADER_RE.test(t) || ISO_DAY_HEADER_RE.test(t)) return false;
    if (LABELED_LINE_RE.test(t) || EMOJI_LABELED_RE.test(t) || HOTEL_LABEL_RE.test(t)) return false;
    if (/제미나이|스케줄|스케쥴|일정|gemini|이용한|만든/i.test(t)) return false;
    return true;
  });
  if (firstLine) {
    meta.title = stripBullet(firstLine).trim();
  }

  if (!meta.title && meta.destination) {
    meta.title = meta.destination + (nightDay ? ` ${nightDay[0]}` : ' 여행');
  }

  // Day 1 제목을 trip title 후보로
  if (!meta.title || /이동\s*:/i.test(meta.title)) {
    for (const line of lines) {
      const hdr = line.trim().match(DAY_HEADER_RE);
      if (hdr?.[5]?.trim()) {
        meta.title = hdr[5].trim().slice(0, 80);
        break;
      }
    }
  }

  return meta;
}

function parseDayHeader(
  line: string,
  defaultYear: number,
): {
  matched: boolean;
  dayIndex: number | null;
  dayDate: string | null;
  dayTitle: string | null;
} {
  const t = line.trim();
  const dayM = t.match(DAY_HEADER_RE);
  if (dayM) {
    const idx = Number(dayM[1] ?? dayM[2] ?? dayM[3]);
    const paren = (dayM[4] ?? '').trim();
    const restTitle = (dayM[5] ?? '').trim();
    const dayDate = paren ? parseKoreanMonthDay(paren, defaultYear) : null;
    return {
      matched: true,
      dayIndex: idx > 0 ? idx : null,
      dayDate,
      dayTitle: restTitle || null,
    };
  }
  const isoM = t.match(ISO_DAY_HEADER_RE);
  if (isoM) {
    return {
      matched: true,
      dayIndex: null,
      dayDate: isoM[1],
      dayTitle: isoM[2]?.trim() || null,
    };
  }
  return { matched: false, dayIndex: null, dayDate: null, dayTitle: null };
}

function appendDescription(item: ParsedImportItem, extra: string): void {
  const bit = extra.trim();
  if (!bit) return;
  item.description = item.description ? `${item.description}\n${bit}` : bit;
}

/**
 * 붙여넣은 자유 텍스트를 여행 메타 + 일정 항목 + 일차 제목으로 파싱.
 * Gemini 스타일(Day N (N월 N일): 제목 / 🏨 호텔 / 🍽️ 미식 노트)과 bullet 형식을 모두 지원.
 */
export function parseItineraryImportText(rawText: string): ParseItineraryImportResult {
  _idSeq = 0;
  const text = rawText.replace(/\r\n/g, '\n').trim();
  if (!text) return { meta: {}, items: [], day_titles: [] };

  const lines = text.split('\n').map((l) => l.trimEnd());
  const defaultYear = new Date().getFullYear();
  const meta = extractTripMeta(lines, defaultYear);
  const year = meta.start_date ? Number(meta.start_date.slice(0, 4)) : defaultYear;

  // 한국 날짜만 있고 year가 올해면, meta 재계산에 쓰는 year 유지
  if (!meta.start_date) {
    const refreshed = extractTripMeta(lines, year);
    Object.assign(meta, refreshed);
  }

  const items: ParsedImportItem[] = [];
  const day_titles: ParsedDayTitle[] = [];
  let currentDayIndex: number | null = 1;
  let currentDayDate: string | null = meta.start_date ?? null;
  let lastItem: ParsedImportItem | null = null;
  let lastHotel: ParsedImportItem | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^제미나이|^gemini|스케줄|스케쥴|앱 일정에 추가/i.test(trimmed) && trimmed.length < 40) {
      continue;
    }

    const dayHdr = parseDayHeader(trimmed, year);
    if (dayHdr.matched) {
      if (dayHdr.dayDate) {
        currentDayDate = dayHdr.dayDate;
        currentDayIndex = dayHdr.dayIndex;
      } else if (dayHdr.dayIndex) {
        currentDayIndex = dayHdr.dayIndex;
        currentDayDate = meta.start_date
          ? addDays(meta.start_date, dayHdr.dayIndex - 1)
          : null;
      }
      if (dayHdr.dayTitle) {
        day_titles.push({
          day_index: currentDayIndex,
          day_date: currentDayDate,
          title: dayHdr.dayTitle,
        });
      }
      lastItem = null;
      continue;
    }

    // 선정 이유 → 직전 숙소/항목 설명으로 합침
    if (REASON_RE.test(trimmed)) {
      const reason = trimmed.replace(REASON_RE, '').trim();
      if (lastHotel) appendDescription(lastHotel, reason ? `선정 이유: ${reason}` : trimmed);
      else if (lastItem) appendDescription(lastItem, reason ? `선정 이유: ${reason}` : trimmed);
      continue;
    }

    // 숙소 상세 부가 줄 (헤난 리조트: ... ) → 직전 호텔 설명
    if (
      lastHotel &&
      !HOTEL_LABEL_RE.test(trimmed) &&
      !DINING_NOTE_RE.test(trimmed) &&
      !TIME_OF_DAY_LABEL_RE.test(trimmed) &&
      !EMOJI_LABELED_RE.test(trimmed) &&
      !BULLET_RE.test(trimmed) &&
      /^(헤난|아모타라|리조트|[A-Za-z가-힣]{2,12}\s*리조트)\s*[:：]/.test(trimmed)
    ) {
      appendDescription(lastHotel, trimmed);
      continue;
    }

    if (!shouldKeepLine(trimmed) && trimmed.length > 90) {
      if (lastItem) {
        appendDescription(lastItem, trimmed);
        continue;
      }
      continue;
    }

    // 숙소 연박 → 이전 호텔 check_out 연장, 새 항목 만들지 않음
    if (ACCOMMODATION_RE.test(trimmed) && STAYOVER_RE.test(trimmed)) {
      if (lastHotel && currentDayDate) {
        const nextOut = addDays(currentDayDate, 1);
        if (!lastHotel.check_out_date || lastHotel.check_out_date < nextOut) {
          lastHotel.check_out_date = nextOut;
        }
        appendDescription(lastHotel, trimmed.replace(HOTEL_LABEL_RE, '').trim());
      }
      continue;
    }

    if (HOTEL_LABEL_RE.test(trimmed) || (/^🏨/.test(trimmed) && ACCOMMODATION_RE.test(trimmed))) {
      const name = cleanHotelName(trimmed);
      if (!name || STAYOVER_RE.test(name)) {
        if (lastHotel && currentDayDate) {
          lastHotel.check_out_date = addDays(currentDayDate, 1);
        }
        continue;
      }
      const afterLabel = trimmed.replace(HOTEL_LABEL_RE, '').replace(/^🏨\s*/, '').trim();
      const engParen = afterLabel.match(/\(([A-Za-z][A-Za-z0-9 .,'&/-]*)\)/);
      const outsideParen = afterLabel.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
      const alsoOr = outsideParen.match(/(?:혹은|또는)\s+(.+)$/);
      const descParts = [
        engParen?.[1]?.trim() || null,
        alsoOr?.[1]?.trim() ? `대안: ${alsoOr[1].trim()}` : null,
      ].filter(Boolean) as string[];
      const item: ParsedImportItem = {
        id: nextId(),
        kind: 'accommodation',
        title: name,
        description: descParts.length ? descParts.join('\n') : null,
        day_index: currentDayIndex,
        day_date: currentDayDate,
        check_in_date: currentDayDate,
        check_out_date: currentDayDate ? addDays(currentDayDate, 1) : null,
        low_confidence: false,
      };
      items.push(item);
      lastItem = item;
      lastHotel = item;
      continue;
    }

    if (DINING_NOTE_RE.test(trimmed) || /^🍽️/.test(trimmed)) {
      const body = trimmed.replace(DINING_NOTE_RE, '').replace(/^🍽️\s*/, '').trim();
      const { title, description } = splitTitleDescription(body || trimmed);
      const item: ParsedImportItem = {
        id: nextId(),
        kind: 'dining',
        title: title || '미식 노트',
        description: description ?? (body && body !== title ? body : null),
        day_index: currentDayIndex,
        day_date: currentDayDate,
        low_confidence: false,
      };
      items.push(item);
      lastItem = item;
      continue;
    }

    const stripped = stripBullet(trimmed);
    const { time, rest } = extractTime(stripped);
    const { kind, low_confidence } = classifyLine(stripped);
    const { title, description } = splitTitleDescription(
      rest.replace(TIME_OF_DAY_LABEL_RE, '').trim() || rest,
    );
    if (!title || title.length < 2) continue;

    // 순수 "선정 이유"만 남은 경우
    if (REASON_RE.test(title) && lastItem) {
      appendDescription(lastItem, title.replace(REASON_RE, '').trim() || title);
      continue;
    }

    const item: ParsedImportItem = {
      id: nextId(),
      kind,
      day_index: currentDayIndex,
      day_date: currentDayDate,
      start_time: time,
      title,
      description,
      low_confidence,
    };

    if (kind === 'transport') {
      item.transport_type = inferTransportType(stripped);
      const { departure, arrival } = parseTransportEndpoints(stripped);
      item.departure = departure;
      item.arrival = arrival;
      if (departure && arrival) {
        item.title = shortTitle(`${departure} → ${arrival}`);
        item.description = stripped;
      }
    }

    if (kind === 'accommodation') {
      item.check_in_date = currentDayDate;
      item.check_out_date = currentDayDate ? addDays(currentDayDate, 1) : null;
      item.title = cleanHotelName(item.title);
      lastHotel = item;
    }

    items.push(item);
    lastItem = item;
  }

  // meta 날짜가 비었으면 day_titles/items에서 보정
  const dated = [
    ...day_titles.map((d) => d.day_date).filter(Boolean),
    ...items.map((i) => i.day_date || i.check_in_date).filter(Boolean),
  ] as string[];
  if (dated.length) {
    dated.sort();
    if (!meta.start_date) meta.start_date = dated[0];
    if (!meta.end_date) meta.end_date = dated[dated.length - 1];
  }

  return { meta, items, day_titles };
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T12:00:00`);
  const b = new Date(`${checkOut}T12:00:00`);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000));
}

/**
 * trip start_date 기준으로 day_index → day_date 재매핑.
 * 마법사에서 연도/시작일을 바꿔도 Day 1·2… 상대 위치가 유지된다.
 */
export function resolveImportItemDates(
  items: ParsedImportItem[],
  tripStart: string,
  tripEnd: string,
): ParsedImportItem[] {
  return items.map((item) => {
    const next = { ...item };

    if (item.day_index != null && item.day_index > 0) {
      const mapped = addDays(tripStart, item.day_index - 1);
      if (item.kind === 'accommodation') {
        const nights =
          item.check_in_date && item.check_out_date
            ? nightsBetween(item.check_in_date, item.check_out_date)
            : 1;
        next.check_in_date = mapped;
        next.day_date = mapped;
        next.check_out_date = addDays(mapped, nights);
        return next;
      }
      next.day_date = mapped;
    } else if (item.kind === 'accommodation') {
      if (!next.check_in_date && next.day_date) next.check_in_date = next.day_date;
      if (!next.day_date && next.check_in_date) next.day_date = next.check_in_date;
      if (!next.check_out_date && next.check_in_date) {
        next.check_out_date = addDays(next.check_in_date, 1);
      }
    }

    if (next.day_date && next.day_date > tripEnd) next.low_confidence = true;
    if (next.day_date && next.day_date < tripStart) next.low_confidence = true;
    if (
      item.kind === 'accommodation' &&
      next.check_in_date &&
      (next.check_in_date < tripStart || next.check_in_date > tripEnd)
    ) {
      next.low_confidence = true;
    }
    return next;
  });
}

export function resolveImportDayTitles(
  dayTitles: ParsedDayTitle[],
  tripStart: string,
): ParsedDayTitle[] {
  return dayTitles
    .map((d) => {
      const day_date =
        d.day_index != null && d.day_index > 0
          ? addDays(tripStart, d.day_index - 1)
          : d.day_date;
      return { ...d, day_date };
    })
    .filter((d) => Boolean(d.day_date && d.title.trim()));
}
