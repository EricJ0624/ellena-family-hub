import type { BabyDailyLog, BabyLogAverages } from '../types';

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

function breastMinutes(log: BabyDailyLog): number {
  return (log.breast_left_min ?? 0) + (log.breast_right_min ?? 0);
}

/**
 * 최근 7일 기준 카드용 평균·횟수 (클라이언트, 로드된 로그만 사용).
 */
export function calcLogAverages(logs: BabyDailyLog[], now = new Date()): BabyLogAverages {
  const since = now.getTime() - AVG_WINDOW_MS;
  const todayStart = startOfLocalDay(now).getTime();

  const feedings = logs.filter(
    (l) => l.log_type === 'feeding' && new Date(l.logged_at).getTime() >= since,
  );
  const mlSamples = feedings
    .map((l) => l.feeding_amount_ml)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  const breastSamples = feedings.map(breastMinutes).filter((v) => v > 0);

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
    feedingCount7d: feedings.length,
    feedingAvgMl:
      mlSamples.length > 0
        ? Math.round(mlSamples.reduce((a, b) => a + b, 0) / mlSamples.length)
        : null,
    feedingAvgBreastMin:
      breastSamples.length > 0
        ? Math.round(breastSamples.reduce((a, b) => a + b, 0) / breastSamples.length)
        : null,
    diaperCountToday: diapersToday.length,
    diaperCount7d: diapers7d.length,
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
