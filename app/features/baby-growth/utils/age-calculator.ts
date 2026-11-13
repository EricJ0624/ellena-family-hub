/**
 * 아기 월령/주령/D-Day 계산 유틸리티
 */

/**
 * 생년월일 기준 경과 일수 (D+n)
 */
export function calcAgeInDays(birthDate: string | Date): number {
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const today = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((today.getTime() - birth.getTime()) / msPerDay);
}

/**
 * 생년월일 기준 월령 (소수점 없이 내림)
 */
export function calcAgeInMonths(birthDate: string | Date): number {
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const today = new Date();
  let months = (today.getFullYear() - birth.getFullYear()) * 12;
  months += today.getMonth() - birth.getMonth();
  if (today.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * 생년월일 기준 주령 (소수점 없이 내림)
 */
export function calcAgeInWeeks(birthDate: string | Date): number {
  return Math.floor(calcAgeInDays(birthDate) / 7);
}

/**
 * D-Day 문자열 반환 (예: "D+365")
 */
export function calcDDay(birthDate: string | Date): string {
  const days = calcAgeInDays(birthDate);
  return `D+${days}`;
}

/**
 * 경과 시간을 "n분 전 / n시간 전 / n일 전" 형식으로 반환
 */
export function formatTimeAgo(
  isoDatetime: string,
  t: { minutes_ago: string; hours_ago: string; days_ago: string }
): string {
  const date = new Date(isoDatetime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHour = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 60) {
    return t.minutes_ago.replace('{n}', String(diffMin === 0 ? 1 : diffMin));
  }
  if (diffHour < 24) {
    return t.hours_ago.replace('{n}', String(diffHour));
  }
  return t.days_ago.replace('{n}', String(diffDay));
}

/**
 * 특정 날짜가 오늘인지 확인
 */
export function isToday(isoDate: string): boolean {
  const d = new Date(isoDate);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

/**
 * date를 'YYYY-MM-DD' ISO date 문자열로 변환
 */
export function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * 두 날짜 사이의 일수 차이 (목표일 - 오늘, 양수=미래, 음수=과거)
 */
export function daysUntil(isoDate: string): number {
  const target = new Date(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
