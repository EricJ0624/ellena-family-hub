/**
 * 일정 시각은 만든 사람의 거주 국가 시간대다.
 * 시간을 비우면 그 시간대의 오전 9시다.
 * 시간대가 여러 개인 나라에서 고르지 않으면 그 나라의 기본 시간대를 쓴다.
 */

export const DEFAULT_EVENT_CLOCK = '09:00';

export type EventTimeZoneOption = {
  id: string;
  label: { ko: string; en: string };
};

const MULTI_ZONES: Record<string, EventTimeZoneOption[]> = {
  US: [
    { id: 'America/New_York', label: { ko: '뉴욕 (동부)', en: 'New York (Eastern)' } },
    { id: 'America/Chicago', label: { ko: '시카고 (중부)', en: 'Chicago (Central)' } },
    { id: 'America/Denver', label: { ko: '덴버 (산악)', en: 'Denver (Mountain)' } },
    { id: 'America/Los_Angeles', label: { ko: '로스앤젤레스 (태평양)', en: 'Los Angeles (Pacific)' } },
    { id: 'America/Anchorage', label: { ko: '앵커리지 (알래스카)', en: 'Anchorage (Alaska)' } },
    { id: 'Pacific/Honolulu', label: { ko: '호놀룰루 (하와이)', en: 'Honolulu (Hawaii)' } },
  ],
  CA: [
    { id: 'America/Toronto', label: { ko: '토론토', en: 'Toronto' } },
    { id: 'America/Winnipeg', label: { ko: '위니펙', en: 'Winnipeg' } },
    { id: 'America/Edmonton', label: { ko: '에드먼턴', en: 'Edmonton' } },
    { id: 'America/Vancouver', label: { ko: '밴쿠버', en: 'Vancouver' } },
    { id: 'America/Halifax', label: { ko: '핼리팩스', en: 'Halifax' } },
    { id: 'America/St_Johns', label: { ko: '세인트존스', en: "St. John's" } },
  ],
  AU: [
    { id: 'Australia/Sydney', label: { ko: '시드니', en: 'Sydney' } },
    { id: 'Australia/Brisbane', label: { ko: '브리즈번', en: 'Brisbane' } },
    { id: 'Australia/Adelaide', label: { ko: '애들레이드', en: 'Adelaide' } },
    { id: 'Australia/Perth', label: { ko: '퍼스', en: 'Perth' } },
    { id: 'Australia/Darwin', label: { ko: '다윈', en: 'Darwin' } },
  ],
  RU: [
    { id: 'Europe/Moscow', label: { ko: '모스크바', en: 'Moscow' } },
    { id: 'Europe/Kaliningrad', label: { ko: '칼리닌그라드', en: 'Kaliningrad' } },
    { id: 'Europe/Samara', label: { ko: '사마라', en: 'Samara' } },
    { id: 'Asia/Yekaterinburg', label: { ko: '예카테린부르크', en: 'Yekaterinburg' } },
    { id: 'Asia/Omsk', label: { ko: '옴스크', en: 'Omsk' } },
    { id: 'Asia/Krasnoyarsk', label: { ko: '크라스노야르스크', en: 'Krasnoyarsk' } },
    { id: 'Asia/Irkutsk', label: { ko: '이르쿠츠크', en: 'Irkutsk' } },
    { id: 'Asia/Yakutsk', label: { ko: '야쿠츠크', en: 'Yakutsk' } },
    { id: 'Asia/Vladivostok', label: { ko: '블라디보스토크', en: 'Vladivostok' } },
    { id: 'Asia/Magadan', label: { ko: '마가단', en: 'Magadan' } },
    { id: 'Asia/Kamchatka', label: { ko: '캄차카', en: 'Kamchatka' } },
  ],
  BR: [
    { id: 'America/Sao_Paulo', label: { ko: '상파울루', en: 'São Paulo' } },
    { id: 'America/Manaus', label: { ko: '마나우스', en: 'Manaus' } },
    { id: 'America/Rio_Branco', label: { ko: '히우브랑쿠', en: 'Rio Branco' } },
    { id: 'America/Noronha', label: { ko: '노로냐', en: 'Fernando de Noronha' } },
  ],
  MX: [
    { id: 'America/Mexico_City', label: { ko: '멕시코시티', en: 'Mexico City' } },
    { id: 'America/Cancun', label: { ko: '칸쿤', en: 'Cancún' } },
    { id: 'America/Hermosillo', label: { ko: '에르모시요', en: 'Hermosillo' } },
    { id: 'America/Tijuana', label: { ko: '티후아나', en: 'Tijuana' } },
  ],
  ID: [
    { id: 'Asia/Jakarta', label: { ko: '자카르타', en: 'Jakarta' } },
    { id: 'Asia/Makassar', label: { ko: '마카사르', en: 'Makassar' } },
    { id: 'Asia/Jayapura', label: { ko: '자야푸라', en: 'Jayapura' } },
  ],
  ES: [
    { id: 'Europe/Madrid', label: { ko: '마드리드', en: 'Madrid' } },
    { id: 'Atlantic/Canary', label: { ko: '카나리아', en: 'Canary Islands' } },
  ],
  PT: [
    { id: 'Europe/Lisbon', label: { ko: '리스본', en: 'Lisbon' } },
    { id: 'Atlantic/Madeira', label: { ko: '마데이라', en: 'Madeira' } },
    { id: 'Atlantic/Azores', label: { ko: '아조레스', en: 'Azores' } },
  ],
  EC: [
    { id: 'America/Guayaquil', label: { ko: '키토', en: 'Quito' } },
    { id: 'Pacific/Galapagos', label: { ko: '갈라파고스', en: 'Galápagos' } },
  ],
  NZ: [
    { id: 'Pacific/Auckland', label: { ko: '오클랜드', en: 'Auckland' } },
    { id: 'Pacific/Chatham', label: { ko: '채텀', en: 'Chatham Islands' } },
  ],
};

const SINGLE_ZONE: Record<string, string> = {
  KR: 'Asia/Seoul',
  JP: 'Asia/Tokyo',
  CN: 'Asia/Shanghai',
  HK: 'Asia/Hong_Kong',
  TW: 'Asia/Taipei',
  SG: 'Asia/Singapore',
  TH: 'Asia/Bangkok',
  VN: 'Asia/Ho_Chi_Minh',
  MY: 'Asia/Kuala_Lumpur',
  PH: 'Asia/Manila',
  IN: 'Asia/Kolkata',
  GB: 'Europe/London',
  GG: 'Europe/London',
  JE: 'Europe/London',
  IM: 'Europe/London',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  IT: 'Europe/Rome',
  NL: 'Europe/Amsterdam',
  BE: 'Europe/Brussels',
  AT: 'Europe/Vienna',
  CH: 'Europe/Zurich',
  LI: 'Europe/Zurich',
  SE: 'Europe/Stockholm',
  IE: 'Europe/Dublin',
  FI: 'Europe/Helsinki',
  GR: 'Europe/Athens',
  CY: 'Asia/Nicosia',
  EE: 'Europe/Tallinn',
  HR: 'Europe/Zagreb',
  LT: 'Europe/Vilnius',
  LU: 'Europe/Luxembourg',
  LV: 'Europe/Riga',
  MT: 'Europe/Malta',
  SI: 'Europe/Ljubljana',
  SK: 'Europe/Bratislava',
  MC: 'Europe/Monaco',
  SM: 'Europe/Rome',
  VA: 'Europe/Rome',
  ME: 'Europe/Belgrade',
  XK: 'Europe/Belgrade',
  AD: 'Europe/Andorra',
  AS: 'Pacific/Pago_Pago',
  SV: 'America/El_Salvador',
  GU: 'Pacific/Guam',
  MH: 'Pacific/Majuro',
  FM: 'Pacific/Pohnpei',
  MP: 'Pacific/Guam',
  PW: 'Pacific/Palau',
  PA: 'America/Panama',
  TL: 'Asia/Dili',
  TC: 'America/Grand_Turk',
  VG: 'America/Tortola',
  BQ: 'America/Kralendijk',
  IO: 'Indian/Chagos',
  CX: 'Indian/Christmas',
  CC: 'Indian/Cocos',
  KI: 'Pacific/Tarawa',
  NR: 'Pacific/Nauru',
  TV: 'Pacific/Funafuti',
  CK: 'Pacific/Rarotonga',
  NU: 'Pacific/Niue',
  PN: 'Pacific/Pitcairn',
};

const KNOWN_ZONES = new Set<string>([
  ...Object.values(SINGLE_ZONE),
  ...Object.values(MULTI_ZONES).flatMap((options) => options.map((option) => option.id)),
]);

export function normalizeEventTime(value: unknown): string | null {
  if (value == null || value === '') return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function normalizeEventTimeZone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const zone = value.trim();
  return KNOWN_ZONES.has(zone) ? zone : null;
}

export function timeZoneOptionsForCountry(country: string | null | undefined): EventTimeZoneOption[] {
  const code = (country || '').trim().toUpperCase();
  return MULTI_ZONES[code] ? [...MULTI_ZONES[code]] : [];
}

/** 시간대를 고르지 않았을 때의 기준. 거주 국가가 없으면 기존과 같이 한국 시간이다. */
export function defaultZoneForCountry(country: string | null | undefined): string {
  const code = (country || '').trim().toUpperCase();
  const multi = MULTI_ZONES[code];
  if (multi?.[0]) return multi[0].id;
  return SINGLE_ZONE[code] || 'Asia/Seoul';
}

export function resolveEventTimeZone(
  storedZone: unknown,
  country: string | null | undefined,
): string {
  return normalizeEventTimeZone(storedZone) || defaultZoneForCountry(country);
}

export function eventClock(storedTime: unknown): string {
  return normalizeEventTime(storedTime) || DEFAULT_EVENT_CLOCK;
}

export function timeZoneOptionLabel(option: EventTimeZoneOption, lang: string): string {
  return lang === 'ko' ? option.label.ko : option.label.en;
}

export function timeZoneLabel(zone: string, lang: string, country?: string | null): string {
  const options = timeZoneOptionsForCountry(country);
  const found = options.find((option) => option.id === zone) || Object.values(MULTI_ZONES).flat().find((option) => option.id === zone);
  if (found) return timeZoneOptionLabel(found, lang);
  const city = zone.split('/').pop()?.replace(/_/g, ' ') || zone;
  return city;
}

export function timeBasisHint(lang: string, zoneLabel?: string | null): string {
  if (!zoneLabel) {
    if (lang === 'ko') return '시간은 거주 국가 기준입니다.';
    if (lang === 'ja') return '時刻は居住国基準です。';
    if (lang === 'zh') return '时间以居住国家为准。';
    if (lang === 'zh-TW') return '時間以居住國家為準。';
    if (lang === 'es') return 'La hora usa tu país de residencia.';
    if (lang === 'fr') return "L'heure suit votre pays de résidence.";
    if (lang === 'de') return 'Zeit nach Ihrem Wohnsitzland.';
    if (lang === 'it') return 'L\'ora usa il paese di residenza.';
    if (lang === 'pt') return 'O horário usa o país de residência.';
    return 'Time uses your country of residence.';
  }
  if (lang === 'ko') return `시간은 ${zoneLabel} 기준입니다.`;
  if (lang === 'ja') return `時刻は${zoneLabel}基準です。`;
  if (lang === 'zh') return `时间以${zoneLabel}为准。`;
  if (lang === 'zh-TW') return `時間以${zoneLabel}為準。`;
  if (lang === 'es') return `La hora usa ${zoneLabel}.`;
  if (lang === 'fr') return `L'heure suit ${zoneLabel}.`;
  if (lang === 'de') return `Zeit nach ${zoneLabel}.`;
  if (lang === 'it') return `L'ora usa ${zoneLabel}.`;
  if (lang === 'pt') return `O horário usa ${zoneLabel}.`;
  return `Time uses ${zoneLabel}.`;
}

export function eventTimeFieldLabel(lang: string): string {
  if (lang === 'ko') return '시간';
  if (lang === 'ja') return '時間';
  if (lang === 'zh') return '时间';
  if (lang === 'zh-TW') return '時間';
  if (lang === 'es') return 'Hora';
  if (lang === 'fr') return 'Heure';
  if (lang === 'de') return 'Uhrzeit';
  if (lang === 'it') return 'Ora';
  if (lang === 'pt') return 'Hora';
  return 'Time';
}

export function eventTimeZoneFieldLabel(lang: string): string {
  if (lang === 'ko') return '시간대';
  if (lang === 'ja') return '時間帯';
  if (lang === 'zh') return '时区';
  if (lang === 'zh-TW') return '時區';
  if (lang === 'es') return 'Zona horaria';
  if (lang === 'pt') return 'Fuso horário';
  if (lang === 'fr') return 'Fuseau horaire';
  if (lang === 'de') return 'Zeitzone';
  if (lang === 'it') return 'Fuso orario';
  return 'Time zone';
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  const asUtc = Date.UTC(pick('year'), pick('month') - 1, pick('day'), pick('hour') % 24, pick('minute'), pick('second'));
  return asUtc - instant.getTime();
}

/** 그 시간대의 벽시계 시각을 UTC 순간으로 바꾼다. */
export function zonedLocalToUtc(dateStr: string, timeHm: string, timeZone: string): Date | null {
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const timeMatch = timeHm.match(/^(\d{2}):(\d{2})/);
  if (!dateMatch || !timeMatch) return null;
  const desiredUtc = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
  );
  let guess = desiredUtc;
  try {
    for (let i = 0; i < 3; i += 1) {
      const next = desiredUtc - zoneOffsetMs(new Date(guess), timeZone);
      if (next === guess) break;
      guess = next;
    }
  } catch {
    return null;
  }
  return new Date(guess);
}

export function localDateInZone(instant: Date, timeZone: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant);
  } catch {
    return null;
  }
}

const DAY_MS = 86_400_000;

/** 일정 시각에서 offset일(24시간 단위) 전. 시간이 없으면 오전 9시다. */
export function reminderFireAt(
  eventDate: string,
  storedTime: unknown,
  timeZone: string,
  offsetDays: number,
): Date | null {
  const start = zonedLocalToUtc(eventDate, eventClock(storedTime), timeZone);
  if (!start) return null;
  return new Date(start.getTime() - offsetDays * DAY_MS);
}

/** 알림 시각이 지났고, 일정 시각 다음 날까지는 한 번 보낼 수 있다. */
export function isReminderFireDue(
  eventDate: string,
  storedTime: unknown,
  timeZone: string,
  offsetDays: number,
  now = new Date(),
): boolean {
  const fire = reminderFireAt(eventDate, storedTime, timeZone, offsetDays);
  if (!fire) return false;
  const startMs = fire.getTime() + offsetDays * DAY_MS;
  const at = now.getTime();
  return at >= fire.getTime() && at <= startMs + DAY_MS;
}

/** 배너가 보일 때 그 시간대의 알림 날짜. 시각 전이거나 날짜가 다르면 null. */
export function visibleReminderFireDay(
  eventDate: string,
  storedTime: unknown,
  timeZone: string,
  offsetDays: number,
  now = new Date(),
): string | null {
  const fire = reminderFireAt(eventDate, storedTime, timeZone, offsetDays);
  if (!fire || now.getTime() < fire.getTime()) return null;
  const fireDay = localDateInZone(fire, timeZone);
  const today = localDateInZone(now, timeZone);
  if (!fireDay || fireDay !== today) return null;
  return fireDay;
}

/** 그 시간대의 다음 자정까지 남은 시간. 일정이 자정을 넘길 때 화면을 다시 그리기 위해 쓴다. */
export function msUntilNextLocalDate(now: Date, timeZone: string): number | null {
  const today = localDateInZone(now, timeZone);
  if (!today) return null;
  const [year, month, day] = today.split('-').map(Number);
  if (!year || !month || !day) return null;
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDate = next.toISOString().slice(0, 10);
  const midnight = zonedLocalToUtc(nextDate, '00:00', timeZone);
  if (!midnight) return null;
  const delta = midnight.getTime() - now.getTime();
  return delta > 0 ? delta : null;
}

export function storedEventClock(row: { event_time?: unknown; event_timezone?: unknown }): {
  event_time: string | null;
  event_timezone: string | null;
} {
  return {
    event_time: normalizeEventTime(row.event_time),
    event_timezone: normalizeEventTimeZone(row.event_timezone),
  };
}
