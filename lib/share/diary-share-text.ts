/** 여행 전체 공유 글. 영수증·파일 경로는 넣지 않는다. */

export function formatShareCoord(latitude: number | null | undefined, longitude: number | null | undefined): string {
  if (latitude == null || longitude == null) return '';
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function diaryShareText(
  trip: { title: string; start_date: string; end_date: string; destination?: string | null },
  slots: Array<{
    day_date: string;
    title: string;
    note?: string | null;
    moods?: string[];
    latitude?: number | null;
    longitude?: number | null;
    expense?: string | null;
  }>,
): string {
  const lines = [trip.title.trim(), [trip.start_date, trip.end_date].filter(Boolean).join(' ~ ')];
  const destination = trip.destination?.trim();
  if (destination) lines.push(destination);
  for (const slot of slots) {
    const title = slot.title.trim();
    const bits = [slot.day_date, title && title !== '—' ? title : ''].filter(Boolean);
    const note = slot.note?.trim() ?? '';
    if (note && note !== title) bits.push(note);
    const moods = (slot.moods ?? []).join(' ').trim();
    if (moods) bits.push(moods);
    const coord = formatShareCoord(slot.latitude, slot.longitude);
    if (coord) bits.push(coord);
    const expense = slot.expense?.trim() ?? '';
    if (expense) bits.push(expense);
    if (bits.length > 0) lines.push(bits.join(' · '));
  }
  return lines.filter(Boolean).join('\n');
}
