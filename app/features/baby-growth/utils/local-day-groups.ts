/** 로컬 날짜 키·시계 시각·날짜별 그룹 (증상/임신 타임라인 공용) */

export type DayGroup<T> = {
  dateKey: string;
  dateLabel: string;
  items: T[];
};

export function formatClockTime(isoOrMs: string | number): string {
  const d = typeof isoOrMs === 'number' ? new Date(isoOrMs) : new Date(isoOrMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function localDateKeyFromMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatLocalDateLabel(dateKey: string): string {
  const [y, m, day] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * 날짜별 묶음(최신 날짜 위).
 * getTime: 항목 시각(ms), sortWithinDay: 당일 정렬(기본 오름차순).
 */
export function groupByLocalDate<T>(
  items: T[],
  getTime: (item: T) => number,
  sortWithinDay: (a: T, b: T) => number = (a, b) => getTime(a) - getTime(b),
): DayGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = localDateKeyFromMs(getTime(item));
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return [...map.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((dateKey) => ({
      dateKey,
      dateLabel: formatLocalDateLabel(dateKey),
      items: (map.get(dateKey) ?? []).slice().sort(sortWithinDay),
    }));
}
