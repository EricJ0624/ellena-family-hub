import type { BabyDailyLog, BabyLogAverages, DiaperType, FeedingType } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const AVG_WINDOW_MS = 7 * DAY_MS;
const MIN_SLEEP_MS = 5 * 60 * 1000;
const MAX_SLEEP_MS = 16 * 60 * 60 * 1000;

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** wet→소변, dirty→대변, mixed→둘 다, dry(깨끗함)·미입력→카운트 없음 */
function countDiaperSide(rows: BabyDailyLog[], side: 'wet' | 'dirty'): number {
  let n = 0;
  for (const l of rows) {
    const t = l.diaper_type as DiaperType | null;
    if (t === 'mixed' || t === side) n += 1;
  }
  return n;
}

/**
 * 모유 = 직수 좌/우 + 모유 젖병(mixed)
 * 분유 = bottle
 * 이유식 = solid
 */
function countFeedingKind(
  rows: BabyDailyLog[],
  kind: 'breast' | 'bottle' | 'solid',
): number {
  let n = 0;
  for (const l of rows) {
    const t = l.feeding_type as FeedingType | null;
    if (kind === 'breast') {
      if (t === 'breast_left' || t === 'breast_right' || t === 'mixed') n += 1;
    } else if (kind === 'bottle') {
      if (t === 'bottle') n += 1;
    } else if (t === 'solid') {
      n += 1;
    }
  }
  return n;
}

/**
 * 최근 7일 기준 카드용 평균·횟수 (클라이언트, 로드된 로그만 사용).
 */
export function calcLogAverages(logs: BabyDailyLog[], now = new Date()): BabyLogAverages {
  const since = now.getTime() - AVG_WINDOW_MS;
  const todayStart = startOfLocalDay(now).getTime();

  const feedings7d = logs.filter(
    (l) => l.log_type === 'feeding' && new Date(l.logged_at).getTime() >= since,
  );
  const feedingsToday = feedings7d.filter((l) => new Date(l.logged_at).getTime() >= todayStart);

  const diapers7d = logs.filter(
    (l) => l.log_type === 'diaper' && new Date(l.logged_at).getTime() >= since,
  );
  const diapersToday = diapers7d.filter((l) => new Date(l.logged_at).getTime() >= todayStart);

  const sleepDurations: number[] = [];
  for (const l of logs) {
    if (l.log_type !== 'sleep' || !l.sleep_end_at) continue;
    const start = new Date(l.logged_at).getTime();
    if (start < since) continue;
    const end = new Date(l.sleep_end_at).getTime();
    const dur = end - start;
    if (!Number.isFinite(dur) || dur < MIN_SLEEP_MS || dur > MAX_SLEEP_MS) continue;
    sleepDurations.push(dur);
  }

  const temps = logs
    .filter(
      (l) =>
        l.log_type === 'temperature' &&
        new Date(l.logged_at).getTime() >= since &&
        typeof l.temperature_celsius === 'number' &&
        Number.isFinite(l.temperature_celsius),
    )
    .map((l) => l.temperature_celsius as number);

  return {
    feedingBreastToday: countFeedingKind(feedingsToday, 'breast'),
    feedingBreast7d: countFeedingKind(feedings7d, 'breast'),
    feedingBottleToday: countFeedingKind(feedingsToday, 'bottle'),
    feedingBottle7d: countFeedingKind(feedings7d, 'bottle'),
    feedingSolidToday: countFeedingKind(feedingsToday, 'solid'),
    feedingSolid7d: countFeedingKind(feedings7d, 'solid'),
    diaperWetToday: countDiaperSide(diapersToday, 'wet'),
    diaperWet7d: countDiaperSide(diapers7d, 'wet'),
    diaperDirtyToday: countDiaperSide(diapersToday, 'dirty'),
    diaperDirty7d: countDiaperSide(diapers7d, 'dirty'),
    sleepAvgMin7d:
      sleepDurations.length > 0
        ? Math.round(
            sleepDurations.reduce((a, b) => a + b, 0) / sleepDurations.length / 60_000,
          )
        : null,
    tempAvgC7d:
      temps.length > 0 ? round1(temps.reduce((a, b) => a + b, 0) / temps.length) : null,
  };
}
