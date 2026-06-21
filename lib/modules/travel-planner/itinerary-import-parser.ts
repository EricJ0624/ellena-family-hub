import type {
  ImportItemKind,
  ParseItineraryImportResult,
  ParsedImportItem,
  ParsedTripMeta,
} from '@/lib/modules/travel-planner/itinerary-import-types';

let _idSeq = 0;
function nextId(): string {
  _idSeq += 1;
  return `import-${_idSeq}`;
}

const DINING_RE =
  /점심|저녁|아침|브런치|식사|맛집|카페|레스토랑|디너|런치|조식|dinner|lunch|breakfast|brunch|restaurant|cafe|café|meal/i;
const ACCOMMODATION_RE =
  /숙소|호텔|체크인|체크아웃|리조트|게스트하우스|펜션|airbnb|bnb|accommodation|hotel|check[\s-]?in|check[\s-]?out|lodging/i;
const TRANSPORT_RE =
  /비행기|항공|공항|기차|KTX|SRT|택시|grab|uber|버스|지하철|렌터카|rental|flight|airport|train|taxi|transfer|이동|출발|도착|→|->/i;
const ATTRACTION_RE =
  /(?:^|\s)왓\s|사원|박물관|궁|공원|랜드마크|관광|전망|야경|temple|museum|palace|park|attraction|sightseeing|tower|market/i;

const DAY_HEADER_RE =
  /^(?:#{1,3}\s*)?(?:(\d{4}-\d{2}-\d{2})|day\s*(\d+)|(\d+)\s*일차|第\s*(\d+)\s*天)/i;
const BULLET_RE = /^[\s]*(?:[-*•●◦]|\d+[.)])\s+/;
const ISO_DATE_RE = /(\d{4})-(\d{2})-(\d{2})/g;
const TIME_RE = /(\d{1,2}):(\d{2})/;
const DATE_RANGE_RE =
  /(\d{4}-\d{2}-\d{2})\s*[~\-–—至到]\s*(\d{4}-\d{2}-\d{2})|(\d{1,2})\/(\d{1,2})\s*[~\-–—至到]\s*(\d{1,2})\/(\d{1,2})/;
const BUDGET_RE = /(?:예산|budget|총\s*예산)[:\s]*([0-9,]+)\s*(?:원|krw|만원)?/i;
const NIGHT_DAY_RE = /(\d+)\s*박\s*(\d+)\s*일/;

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

function classifyLine(text: string): { kind: ImportItemKind; low_confidence: boolean } {
  const t = text.trim();
  if (!t) return { kind: 'other', low_confidence: true };

  const dining = DINING_RE.test(t) ? 3 : 0;
  const acc = ACCOMMODATION_RE.test(t) ? 3 : 0;
  let transport = TRANSPORT_RE.test(t) ? 3 : 0;
  let attraction = ATTRACTION_RE.test(t) ? 2 : 0;

  if (/디너|dinner|크루즈/i.test(t)) dining += 2;
  if (/^왓\s|wat\s/i.test(t)) attraction += 2;
  if (/→|->/.test(t) && transport > 0) transport += 1;

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
  if (bestScore === secondScore) return { kind: 'other', low_confidence: true };
  return { kind: bestKind, low_confidence: false };
}

function inferTransportType(text: string): 'air' | 'train' | 'car' | 'bike' {
  if (/비행|항공|flight|airport/i.test(text)) return 'air';
  if (/기차|KTX|SRT|train/i.test(text)) return 'train';
  if (/바이크|bike|자전거/i.test(text)) return 'bike';
  return 'car';
}

function parseTransportEndpoints(text: string): { departure: string | null; arrival: string | null } {
  const arrow = text.split(/→|->|→/);
  if (arrow.length >= 2) {
    return {
      departure: arrow[0].replace(TIME_RE, '').trim() || null,
      arrival: arrow.slice(1).join(' ').trim() || null,
    };
  }
  return { departure: null, arrival: null };
}

function extractTitleFromLine(rest: string): string {
  let title = rest
    .replace(/^(점심|저녁|아침|브런치|식사|디너|lunch|dinner|breakfast)[:\s：-]*/i, '')
    .trim();
  title = title.replace(/^[\[\(（【][^\]\)）】]+[\]\)）】]\s*/, '').trim();
  return title || rest.trim();
}

function parseAccommodationLine(
  line: string,
  defaultYear: number,
): ParsedImportItem | null {
  const raw = stripBullet(line);
  if (!ACCOMMODATION_RE.test(raw)) return null;

  let checkIn: string | null = null;
  let checkOut: string | null = null;

  const isoRange = raw.match(/(\d{4}-\d{2}-\d{2})\s*[~\-–—至到]\s*(\d{4}-\d{2}-\d{2})/);
  if (isoRange) {
    checkIn = isoRange[1];
    checkOut = isoRange[2];
  } else {
    const slashRange = raw.match(/(\d{1,2})\/(\d{1,2})\s*[~\-–—至到]\s*(\d{1,2})\/(\d{1,2})/);
    if (slashRange) {
      checkIn = toIsoDate(defaultYear, Number(slashRange[1]), Number(slashRange[2]));
      checkOut = toIsoDate(defaultYear, Number(slashRange[3]), Number(slashRange[4]));
    }
  }

  const name = raw
    .replace(DATE_RANGE_RE, '')
    .replace(/숙소[:\s：]*/i, '')
    .replace(/호텔[:\s：]*/i, '')
    .replace(/\(.*?\)/g, '')
    .trim();

  if (!name && !checkIn) return null;

  return {
    id: nextId(),
    kind: 'accommodation',
    title: name || '숙소',
    check_in_date: checkIn,
    check_out_date: checkOut,
    day_date: checkIn,
    low_confidence: false,
  };
}

function extractTripMeta(lines: string[]): ParsedTripMeta {
  const meta: ParsedTripMeta = {};
  const head = lines.slice(0, 8).join('\n');

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
  if (isoDates.length >= 2) {
    isoDates.sort();
    meta.start_date = isoDates[0];
    meta.end_date = isoDates[isoDates.length - 1];
  } else if (isoDates.length === 1) {
    meta.start_date = isoDates[0];
  }

  const nightDay = head.match(NIGHT_DAY_RE);
  if (nightDay && meta.start_date && !meta.end_date) {
    const days = Number(nightDay[2]);
    if (days > 1) meta.end_date = addDays(meta.start_date, days - 1);
  }

  const destMatch = head.match(
    /(?:^|\n)(?:.{0,20}?)(방콕|파리|도쿄|오사카|서울|부산|제주|뉴욕|런던|싱가포르|다낭|호치민|하노이|발리|세부|타이베이|홍콩|마카오|시드니|로마|바르셀로나|방콕|치앙마이|푸켓|[가-힣]{2,8})\s*(?:\d+\s*박|$)/m,
  );
  if (destMatch?.[1]) {
    meta.destination = destMatch[1].trim();
  }

  const firstLine = lines.find((l) => l.trim() && !BULLET_RE.test(l) && !DAY_HEADER_RE.test(l.trim()));
  if (firstLine && firstLine.length < 80) {
    meta.title = stripBullet(firstLine).trim();
  }

  if (!meta.title && meta.destination) {
    meta.title = meta.destination + (nightDay ? ` ${nightDay[0]}` : ' 여행');
  }

  return meta;
}

function parseDayHeader(line: string): { dayIndex: number | null; dayDate: string | null } {
  const t = line.trim();
  const m = t.match(DAY_HEADER_RE);
  if (!m) return { dayIndex: null, dayDate: null };
  if (m[1]) return { dayIndex: null, dayDate: m[1] };
  const idx = Number(m[2] ?? m[3] ?? m[4]);
  if (idx > 0) return { dayIndex: idx, dayDate: null };
  return { dayIndex: null, dayDate: null };
}

/**
 * 붙여넣은 자유 텍스트를 여행 메타 + 일정 항목으로 파싱.
 */
export function parseItineraryImportText(rawText: string): ParseItineraryImportResult {
  _idSeq = 0;
  const text = rawText.replace(/\r\n/g, '\n').trim();
  if (!text) return { meta: {}, items: [] };

  const lines = text.split('\n').map((l) => l.trimEnd());
  const meta = extractTripMeta(lines);
  const defaultYear = meta.start_date
    ? Number(meta.start_date.slice(0, 4))
    : new Date().getFullYear();

  const items: ParsedImportItem[] = [];
  let currentDayIndex: number | null = 1;
  let currentDayDate: string | null = meta.start_date ?? null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const dayHdr = parseDayHeader(trimmed);
    if (DAY_HEADER_RE.test(trimmed)) {
      if (dayHdr.dayDate) {
        currentDayDate = dayHdr.dayDate;
        currentDayIndex = null;
      } else if (dayHdr.dayIndex) {
        currentDayIndex = dayHdr.dayIndex;
        currentDayDate = meta.start_date
          ? addDays(meta.start_date, dayHdr.dayIndex - 1)
          : null;
      }
      continue;
    }

    const acc = parseAccommodationLine(trimmed, defaultYear);
    if (acc) {
      items.push(acc);
      continue;
    }

    if (!BULLET_RE.test(trimmed) && !TIME_RE.test(trimmed) && trimmed.length > 60) continue;

    const stripped = stripBullet(trimmed);
    const { time, rest } = extractTime(stripped);
    const title = extractTitleFromLine(rest);
    if (!title || title.length < 2) continue;

    const { kind, low_confidence } = classifyLine(stripped);

    const item: ParsedImportItem = {
      id: nextId(),
      kind,
      day_index: currentDayIndex,
      day_date: currentDayDate,
      start_time: time,
      title,
      low_confidence,
    };

    if (kind === 'transport') {
      item.transport_type = inferTransportType(stripped);
      const { departure, arrival } = parseTransportEndpoints(stripped);
      item.departure = departure;
      item.arrival = arrival;
      if (!item.title || item.title === departure) {
        item.title =
          departure && arrival ? `${departure} → ${arrival}` : title;
      }
    }

    items.push(item);
  }

  return { meta, items };
}

/** trip start_date 기준으로 day_index → day_date 보정 */
export function resolveImportItemDates(
  items: ParsedImportItem[],
  tripStart: string,
  tripEnd: string,
): ParsedImportItem[] {
  return items.map((item) => {
    const next = { ...item };
    if (item.kind === 'accommodation') {
      if (item.check_in_date) next.day_date = item.check_in_date;
      if (!item.check_out_date && item.check_in_date) {
        next.check_out_date = item.check_in_date;
      }
      return next;
    }
    if (next.day_date) return next;
    if (item.day_index != null && item.day_index > 0) {
      next.day_date = addDays(tripStart, item.day_index - 1);
    }
    if (next.day_date && next.day_date > tripEnd) {
      next.low_confidence = true;
    }
    if (next.day_date && next.day_date < tripStart) {
      next.low_confidence = true;
    }
    return next;
  });
}
