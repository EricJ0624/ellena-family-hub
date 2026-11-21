/**
 * Prenatal / Postnatal 모드 헬퍼.
 * birth_date null → Prenatal. due_date 기준 D-day·주수(예정일 앵커, 추정).
 */

import type { BabyProfile } from '../types';

const MS_DAY = 24 * 60 * 60 * 1000;
/** 만삭 기준 주수 (예정일 = 임신 40주 시점 가정) */
const TERM_WEEKS = 40;

export function isPrenatal(profile: Pick<BabyProfile, 'birth_date'> | null | undefined): boolean {
  return !profile?.birth_date;
}

export function displayBabyName(profile: Pick<BabyProfile, 'name' | 'fetal_name' | 'birth_date'>): string {
  if (isPrenatal(profile) && profile.fetal_name?.trim()) return profile.fetal_name.trim();
  return profile.name;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseDateOnly(iso: string): Date {
  const [y, m, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
}

/** 출산까지 남은 일수 (음수면 예정일 지남) */
export function daysUntilDue(dueDate: string, now = new Date()): number {
  const due = startOfLocalDay(parseDateOnly(dueDate));
  const today = startOfLocalDay(now);
  return Math.round((due.getTime() - today.getTime()) / MS_DAY);
}

/**
 * 예정일 기준 추정 임신 주수.
 * due_date ≈ 40주 완료 시점으로 보고: weeks = 40 - ceil(D-day/7), 0~42 클램프.
 */
export function weeksPregnantFromDue(dueDate: string, now = new Date()): number {
  const dDay = daysUntilDue(dueDate, now);
  const remainingWeeks = Math.ceil(dDay / 7);
  const weeks = TERM_WEEKS - remainingWeeks;
  return Math.max(0, Math.min(42, weeks));
}

/** 출생일·예정일로 출산 시 재태주수 추정 */
export function estimateGestationalWeeksAtBirth(
  dueDate: string | null | undefined,
  birthDate: string,
): number | null {
  if (!dueDate) return null;
  const due = startOfLocalDay(parseDateOnly(dueDate));
  const birth = startOfLocalDay(parseDateOnly(birthDate));
  const daysEarly = Math.round((due.getTime() - birth.getTime()) / MS_DAY);
  const weeks = TERM_WEEKS - daysEarly / 7;
  const rounded = Math.round(weeks * 10) / 10;
  return Math.max(20, Math.min(45, rounded));
}

export interface GestationalProgress {
  daysUntilDue: number;
  weeksPregnant: number;
  /** 예: D-142 / D+3 */
  ddayLabel: string;
}

export function gestationalProgress(
  dueDate: string,
  now = new Date(),
): GestationalProgress {
  const days = daysUntilDue(dueDate, now);
  const weeks = weeksPregnantFromDue(dueDate, now);
  const ddayLabel = days >= 0 ? `D-${days}` : `D+${Math.abs(days)}`;
  return { daysUntilDue: days, weeksPregnant: weeks, ddayLabel };
}
