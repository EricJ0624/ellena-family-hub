/**
 * 수면 2트랙
 * - 트랙 A: 프로필 평소 취침/기상 (실기록 없으면 이 시각을 사용, 추정)
 * - 트랙 B: 취침/기상 버튼 실기록 (있으면 해당 시각 우선)
 */

import type { BabyDailyLog, BabyProfile } from '../types';
import { formatTimeAgo } from './age-calculator';

export interface SleepAgoLabels {
  minutes_ago: string;
  hours_ago: string;
  days_ago: string;
  sleep_in_progress: string;
  sleep_estimated: string;
  no_record: string;
}

const ACTIVE_OPEN_MS = 20 * 60 * 60 * 1000;

function parseClock(value: string | null | undefined): { h: number; m: number } | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

function atClock(day: Date, clock: { h: number; m: number }): Date {
  const d = new Date(day);
  d.setHours(clock.h, clock.m, 0, 0);
  return d;
}

/** start 이후 첫 평소 기상 시각 */
function scheduledWakeAfter(start: Date, wakeTime: string): Date | null {
  const clock = parseClock(wakeTime);
  if (!clock) return null;
  const sameDay = atClock(start, clock);
  if (sameDay.getTime() > start.getTime()) return sameDay;
  const next = new Date(sameDay);
  next.setDate(next.getDate() + 1);
  return next;
}

/** 기상 버튼을 눌렀을 때, 취침 실기록이 없으면 쓸 평소 취침 시각 */
export function scheduledBedBefore(wakeAt: Date, bedTime: string): Date | null {
  const clock = parseClock(bedTime);
  if (!clock) return null;
  const sameDay = atClock(wakeAt, clock);
  if (sameDay.getTime() < wakeAt.getTime()) return sameDay;
  const prev = new Date(sameDay);
  prev.setDate(prev.getDate() - 1);
  return prev;
}

interface NightWindow {
  start: Date;
  end: Date;
  inProgress: boolean;
}

/** 취침만 있고 아직 기상 전인 세션. 평소 기상 + 2시간이 지났거나 20시간이 넘으면 새 기록으로 취급하지 않는다. */
export function findCurrentOpenSleep(
  logs: BabyDailyLog[],
  now = new Date(),
  wakeTime?: string | null,
): BabyDailyLog | null {
  const opens = logs
    .filter((l) => l.log_type === 'sleep' && !l.sleep_end_at)
    .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
  for (const log of opens) {
    const start = new Date(log.logged_at);
    if (now.getTime() - start.getTime() > ACTIVE_OPEN_MS) continue;
    if (wakeTime) {
      const scheduled = scheduledWakeAfter(start, wakeTime);
      if (scheduled && now.getTime() > scheduled.getTime() + 2 * 60 * 60 * 1000) continue;
    }
    return log;
  }
  return null;
}

/** 지금 기준 가장 최근 야간 구간 (평소 시각만으로 계산) */
function lastNightWindow(now: Date, bedTime: string, wakeTime: string): NightWindow | null {
  const bed = parseClock(bedTime);
  const wake = parseClock(wakeTime);
  if (!bed || !wake) return null;

  const todayWake = atClock(now, wake);
  const todayBed = atClock(now, bed);
  const overnight = bed.h * 60 + bed.m > wake.h * 60 + wake.m;

  if (!overnight) {
    const inProgress = now >= todayBed && now < todayWake;
    return { start: todayBed, end: todayWake, inProgress };
  }

  if (now < todayWake) {
    const start = atClock(new Date(now.getTime() - 86_400_000), bed);
    return { start, end: todayWake, inProgress: true };
  }
  if (now >= todayBed) {
    const end = atClock(new Date(now.getTime() + 86_400_000), wake);
    return { start: todayBed, end, inProgress: true };
  }
  const start = atClock(new Date(now.getTime() - 86_400_000), bed);
  return { start, end: todayWake, inProgress: false };
}

function formatDurationMs(ms: number): string {
  const totalMin = Math.max(1, Math.round(Math.max(0, ms) / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

function withEstimate(text: string, estimated: boolean, label: string): string {
  return estimated ? `${text} · ${label}` : text;
}

export function describeLastSleep(
  profile: Pick<BabyProfile, 'usual_bedtime' | 'usual_wake_time'> | null,
  logs: BabyDailyLog[],
  t: SleepAgoLabels,
  now = new Date(),
): string {
  const bedTime = profile?.usual_bedtime ?? null;
  const wakeTime = profile?.usual_wake_time ?? null;
  const window = bedTime && wakeTime ? lastNightWindow(now, bedTime, wakeTime) : null;
  const bound = window ? window.start.getTime() - 2 * 60 * 60 * 1000 : now.getTime() - 36 * 60 * 60 * 1000;

  const recent = logs
    .filter((l) => l.log_type === 'sleep')
    .filter((l) => {
      const start = new Date(l.logged_at).getTime();
      const end = l.sleep_end_at ? new Date(l.sleep_end_at).getTime() : 0;
      return start >= bound || end >= bound;
    })
    .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());

  const open = recent.find((l) => !l.sleep_end_at) ?? null;
  if (open) {
    const start = new Date(open.logged_at);
    const scheduledEnd = wakeTime ? scheduledWakeAfter(start, wakeTime) : null;
    if (scheduledEnd && now.getTime() >= scheduledEnd.getTime()) {
      const text = `${formatDurationMs(scheduledEnd.getTime() - start.getTime())} · ${formatTimeAgo(scheduledEnd.toISOString(), t)}`;
      return withEstimate(text, true, t.sleep_estimated);
    }
    const sleeping = `${t.sleep_in_progress} · ${formatDurationMs(now.getTime() - start.getTime())}`;
    return open.sleep_start_recorded === false ? withEstimate(sleeping, true, t.sleep_estimated) : sleeping;
  }

  const last = recent.find((l) => l.sleep_end_at) ?? null;
  if (last?.sleep_end_at) {
    const start = new Date(last.logged_at).getTime();
    const end = new Date(last.sleep_end_at).getTime();
    const estimated = last.sleep_start_recorded === false || last.sleep_end_recorded === false;
    const text = `${formatDurationMs(end - start)} · ${formatTimeAgo(last.sleep_end_at, t)}`;
    return withEstimate(text, estimated, t.sleep_estimated);
  }

  if (window) {
    if (window.inProgress) {
      return withEstimate(
        `${t.sleep_in_progress} · ${formatDurationMs(now.getTime() - window.start.getTime())}`,
        true,
        t.sleep_estimated,
      );
    }
    const text = `${formatDurationMs(window.end.getTime() - window.start.getTime())} · ${formatTimeAgo(window.end.toISOString(), t)}`;
    return withEstimate(text, true, t.sleep_estimated);
  }

  return t.no_record;
}
