import type { TravelAccommodation, TravelEmergencyContacts, TravelPackingItem, TravelTrip } from './types';
import {
  buildAutoFlightSummary,
  formatTripDurationKo,
  normalizeEmergencyContacts,
  normalizePackingChecklist,
  resolveCoverBadge,
} from './document-meta';
import { shortItineraryTitle } from './short-itinerary-title';
import { enumerateTripDays } from './itinerary-display-expand';

export type HtmlDocItem = {
  type: 'accommodation' | 'dining' | 'attraction' | 'transport' | 'other';
  day_date: string;
  start_time?: string | null;
  end_time?: string | null;
  title: string;
  description?: string | null;
  address?: string | null;
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Noto Sans KR", "Noto Sans CJK KR", "Malgun Gothic", sans-serif;
    color: #1e293b;
    background: #F7F5F2;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { padding: 8mm 6mm 10mm; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .badge {
    display: inline-block;
    background: #D88C75;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 6px 12px;
    border-radius: 6px;
  }
  h1 { font-size: 28px; margin: 18px 0 8px; line-height: 1.25; }
  .sub { color: #64748b; font-size: 15px; margin: 0; }
  .card {
    background: #fff;
    border: 1px solid #f1f5f9;
    border-radius: 16px;
    padding: 14px 16px;
    margin-top: 28px;
    box-shadow: 0 1px 2px rgba(15,23,42,0.04);
  }
  .meta-row {
    display: flex;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid #f1f5f9;
  }
  .meta-row:last-child { border-bottom: none; }
  .meta-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: #94a3b8;
    text-transform: uppercase;
  }
  .meta-value { font-size: 15px; font-weight: 700; margin-top: 2px; }
  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 8px;
  }
  .section-head h2 { margin: 0; font-size: 20px; }
  .section-head span { font-size: 11px; color: #94a3b8; }
  .accent-line { height: 1px; background: #D88C75; margin-bottom: 18px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .ov-card {
    background: #fff;
    border: 1px solid #f1f5f9;
    border-radius: 16px;
    padding: 14px;
    page-break-inside: avoid;
  }
  .ov-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    margin: 0 0 10px;
  }
  .bar {
    width: 4px;
    height: 14px;
    background: #D88C75;
    border-radius: 2px;
    display: inline-block;
  }
  .row {
    display: grid;
    grid-template-columns: 7.5rem 1fr;
    gap: 8px;
    padding: 10px 0;
    border-bottom: 1px solid #f1f5f9;
    font-size: 12px;
  }
  .row:last-child { border-bottom: none; }
  .row dt { color: #94a3b8; font-weight: 500; margin: 0; }
  .row dd { margin: 0; font-weight: 700; }
  .day-card {
    background: #fff;
    border: 1px solid #f1f5f9;
    border-radius: 16px;
    padding: 16px;
    margin-bottom: 12px;
    page-break-inside: avoid;
  }
  .day-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    margin: 0 0 14px;
  }
  .slot { margin-bottom: 16px; }
  .slot:last-child { margin-bottom: 0; }
  .time { color: #D88C75; font-size: 12px; font-weight: 700; }
  .slot-title { font-size: 14px; font-weight: 700; margin-top: 2px; }
  .slot-desc { font-size: 12px; color: #64748b; margin-top: 4px; line-height: 1.5; }
`;

export function buildItineraryDocumentHtml(params: {
  trip: TravelTrip;
  items: HtmlDocItem[];
  accommodations: TravelAccommodation[];
  transports: Array<{
    transport_type: string;
    departure?: string | null;
    arrival?: string | null;
  }>;
  dayTitles: Record<string, string>;
  labels: {
    overviewKo: string;
    overviewEn: string;
    detailsKo: string;
    detailsEn: string;
  };
}): string {
  const { trip, items, accommodations, transports, dayTitles, labels } = params;
  const badge = resolveCoverBadge(trip);
  const duration = formatTripDurationKo(trip.start_date, trip.end_date);
  const travelers = (trip.travelers_text ?? '').trim();
  const theme = (trip.theme ?? '').trim();
  const subtitle = (trip.subtitle ?? '').trim();
  const emergency = normalizeEmergencyContacts(trip.emergency_contacts as TravelEmergencyContacts | null);
  const packing = normalizePackingChecklist(trip.packing_checklist as TravelPackingItem[] | null);
  const flight =
    (trip.flight_summary ?? '').trim() || buildAutoFlightSummary(transports) || '';
  const hotel = accommodations[0];
  const hotelName = hotel?.name?.trim() || '';
  const checkIn = hotel?.check_in_time?.trim()
    ? `${hotel.check_in_time} 이후`
    : hotel
      ? hotel.check_in_date
      : '';

  const days = enumerateTripDays(trip.start_date, trip.end_date);
  const byDay = new Map<string, HtmlDocItem[]>();
  for (const it of items) {
    const list = byDay.get(it.day_date) ?? [];
    list.push(it);
    byDay.set(it.day_date, list);
  }
  const packingByCat = new Map<string, TravelPackingItem[]>();
  for (const p of packing) {
    const list = packingByCat.get(p.category) ?? [];
    list.push(p);
    packingByCat.set(p.category, list);
  }

  const hasOverview = Boolean(
    flight || hotelName || emergency.local || emergency.consular || emergency.embassy || packing.length > 0,
  );

  const metaRows = [
    ['TRIP DURATION', duration],
    ['TRAVELERS', travelers],
    ['MAIN THEME', theme],
  ]
    .filter(([, v]) => v)
    .map(
      ([label, value]) => `
      <div class="meta-row">
        <div>
          <div class="meta-label">${esc(label)}</div>
          <div class="meta-value">${esc(value)}</div>
        </div>
      </div>`,
    )
    .join('');

  const overviewRows = (rows: Array<[string, string]>) =>
    rows
      .filter(([, v]) => v.trim())
      .map(
        ([label, value]) => `
        <div class="row"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`,
      )
      .join('');

  const packingBlock =
    packing.length === 0
      ? ''
      : `
    <div class="ov-card" style="margin-top:12px">
      <h3 class="ov-title"><span class="bar"></span>🎒 패밀리 준비물 체크리스트</h3>
      ${[...packingByCat.entries()]
        .map(
          ([cat, list]) => `
        <div class="row"><dt>${esc(cat)}</dt><dd>${esc(
          list.map((p) => (p.checked ? `✓ ${p.text}` : p.text)).join(', '),
        )}</dd></div>`,
        )
        .join('')}
    </div>`;

  const overviewPage = !hasOverview
    ? ''
    : `
  <section class="page">
    <div class="section-head">
      <h2>${esc(labels.overviewKo)}</h2>
      <span>${esc(labels.overviewEn)}</span>
    </div>
    <div class="accent-line"></div>
    <div class="grid2">
      <div class="ov-card">
        <h3 class="ov-title"><span class="bar"></span>✈️ 항공 및 호텔 정보</h3>
        ${overviewRows([
          ['항공편', flight],
          ['숙소', hotelName],
          ['체크인', checkIn],
        ])}
      </div>
      <div class="ov-card">
        <h3 class="ov-title"><span class="bar"></span>🚨 긴급 연락처</h3>
        ${overviewRows([
          ['현지 긴급', emergency.local ?? ''],
          ['영사콜센터', emergency.consular ?? ''],
          ['비상 대사관', emergency.embassy ?? ''],
        ])}
      </div>
    </div>
    ${packingBlock}
  </section>`;

  const activeDays = days.filter((d) => (byDay.get(d) ?? []).length > 0 || (dayTitles[d] ?? '').trim());
  const chunks: string[][] = [];
  for (let i = 0; i < activeDays.length; i += 2) chunks.push(activeDays.slice(i, i + 2));
  if (chunks.length === 0) {
    chunks.push([]);
  }

  const detailPages = chunks
    .map((chunk) => {
      const dayNums = chunk.map((d) => days.indexOf(d) + 1);
      const rangeLabel =
        dayNums.length === 0
          ? ''
          : dayNums.length === 1
            ? `Day ${dayNums[0]}`
            : `Day ${dayNums[0]} - Day ${dayNums[dayNums.length - 1]}`;
      const cards =
        chunk.length === 0
          ? `<p style="color:#94a3b8;font-size:13px">등록된 상세 일정이 없습니다.</p>`
          : chunk
              .map((dayYmd) => {
                const dayNum = days.indexOf(dayYmd) + 1;
                const dayTitle = (dayTitles[dayYmd] ?? '').trim();
                const dayItems = byDay.get(dayYmd) ?? [];
                const slots =
                  dayItems.length === 0
                    ? `<p style="color:#94a3b8;font-size:13px">이 날 일정 없음</p>`
                    : dayItems
                        .map((it) => {
                          const time =
                            it.start_time || it.end_time
                              ? `${it.start_time || '--'} - ${it.end_time || '--'}`
                              : '';
                          const title = shortItineraryTitle(it.type, it.title, it.address);
                          return `
                      <div class="slot">
                        ${time ? `<div class="time">${esc(time)}</div>` : ''}
                        <div class="slot-title">${esc(title)}</div>
                        ${it.description ? `<div class="slot-desc">${esc(it.description)}</div>` : ''}
                      </div>`;
                        })
                        .join('');
                return `
              <article class="day-card">
                <h3 class="day-title"><span class="bar"></span>☀️ Day ${dayNum}${
                  dayTitle ? ` : ${esc(dayTitle)}` : ''
                }</h3>
                ${slots}
              </article>`;
              })
              .join('');

      return `
    <section class="page">
      <div class="section-head">
        <h2>${esc(labels.detailsKo)}${rangeLabel ? ` (${esc(rangeLabel)})` : ''}</h2>
        <span>${esc(labels.detailsEn)}</span>
      </div>
      <div class="accent-line"></div>
      ${cards}
    </section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
  <style>
  @font-face {
    font-family: "Noto Sans KR";
    font-style: normal;
    font-weight: 400;
    font-display: swap;
    src: url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/woff2/Pretendard-Regular.woff2") format("woff2");
  }
  @font-face {
    font-family: "Noto Sans KR";
    font-style: normal;
    font-weight: 700;
    font-display: swap;
    src: url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/woff2/Pretendard-Bold.woff2") format("woff2");
  }
  ${CSS}
  </style>
</head>
<body>
  <section class="page">
    <div class="badge">${esc(badge)}</div>
    <h1>${esc(trip.title)}</h1>
    ${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ''}
    <div class="card">${metaRows}</div>
  </section>
  ${overviewPage}
  ${detailPages}
</body>
</html>`;
}
