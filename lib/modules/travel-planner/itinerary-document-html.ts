import type { TravelAccommodation, TravelEmergencyContacts, TravelPackingItem, TravelTrip } from './types';
/**
 * 일정표(브로슈어) HTML — 미리보기·서버 PDF의 단일 소스.
 * 디자인/문구/섹션 변경은 이 파일만 수정하면 양쪽이 동일하게 반영됩니다.
 */
import {
  buildAutoFlightSummary,
  formatTripDurationKo,
  formatTravelersFromNames,
  normalizePackingChecklist,
  resolveCoverBadge,
} from './document-meta';
import { resolveEmergencyForDocument } from './emergency-contacts-auto';
import { shortItineraryTitle } from './short-itinerary-title';
import { enumerateTripDays } from './itinerary-display-expand';
import { docSectionIconHtml, type DocSectionIconKind } from './doc-section-icons';

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

function ovTitle(kind: DocSectionIconKind, title: string): string {
  return `<h3 class="ov-title"><span class="bar"></span>${docSectionIconHtml(kind)}<span>${esc(title)}</span></h3>`;
}

const CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "ItineraryDocSans", "Noto Sans KR", "Malgun Gothic", sans-serif;
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
  .ov-emoji {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    display: block;
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
  .cover-img-wrap { margin-top: 20px; border-radius: 16px; overflow: hidden; }
  .cover-img { width: 100%; max-height: 220px; object-fit: cover; display: block; }
  .hotel-block { padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
  .hotel-block:last-child { border-bottom: none; }
  .hotel-name { font-size: 14px; font-weight: 700; }
  .hotel-line { font-size: 12px; color: #64748b; margin-top: 4px; }
  .hotel-memo { font-size: 12px; color: #475569; margin-top: 6px; }
  .map-img { width: 100%; border-radius: 12px; display: block; margin-top: 8px; }
`;

export function buildItineraryDocumentHtml(params: {
  trip: TravelTrip;
  items: HtmlDocItem[];
  accommodations: TravelAccommodation[];
  transports: Array<{
    transport_type: string;
    departure?: string | null;
    arrival?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    memo?: string | null;
  }>;
  dayTitles: Record<string, string>;
  labels: {
    overviewKo: string;
    overviewEn: string;
    detailsKo: string;
    detailsEn: string;
  };
  travelerNames?: string[];
  /** 여행 참가자 국적 ISO */
  travelerNationalities?: string[];
  coverImageUrl?: string | null;
  mapImageUrl?: string | null;
}): string {
  const { trip, items, accommodations, transports, dayTitles, labels } = params;
  const badge = resolveCoverBadge(trip);
  const duration = formatTripDurationKo(trip.start_date, trip.end_date);
  const travelers = formatTravelersFromNames(params.travelerNames ?? []);
  const theme = (trip.theme ?? '').trim();
  const subtitle = (trip.subtitle ?? '').trim();
  const emergency = resolveEmergencyForDocument({
    destination: trip.destination,
    stored: trip.emergency_contacts as TravelEmergencyContacts | null,
    travelerNationalities: params.travelerNationalities,
    locationParts: [
      trip.title,
      ...accommodations.flatMap((a) => [a.name, a.address, a.memo]),
      ...transports.flatMap((t) => [t.departure, t.arrival, t.memo]),
      ...items.flatMap((it) => [it.title, it.description, it.address]),
    ],
  });
  const packing = normalizePackingChecklist(trip.packing_checklist as TravelPackingItem[] | null);
  const flight = buildAutoFlightSummary(transports) || '';
  const hotels = accommodations.filter((a) => (a.name ?? '').trim());
  const cover = (params.coverImageUrl ?? '').trim();
  const mapUrl = (params.mapImageUrl ?? '').trim();

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

  const metaRows = [
    ['TRIP DURATION', duration],
    ['TRAVELERS', travelers || '—'],
    ['MAIN THEME', theme || '—'],
  ]
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
      .map(([label, value]) => {
        const v = value.trim() || '—';
        return `
        <div class="row"><dt>${esc(label)}</dt><dd>${esc(v)}</dd></div>`;
      })
      .join('');

  const formatStay = (a: TravelAccommodation) => {
    const cin = a.check_in_time?.trim()
      ? `${a.check_in_date} ${a.check_in_time}`
      : a.check_in_date;
    const cout = a.check_out_time?.trim()
      ? `${a.check_out_date} ${a.check_out_time}`
      : a.check_out_date;
    return `${cin} → ${cout}`;
  };

  const hotelBlock =
    hotels.length === 0
      ? `
    <div class="ov-card" style="margin-top:12px">
      ${ovTitle('hotel', '호텔 / 숙소')}
      <p style="margin:0;font-size:13px;color:#94a3b8">숙소 메뉴에서 등록하면 여기에 표시됩니다.</p>
    </div>`
      : `
    <div class="ov-card" style="margin-top:12px">
      ${ovTitle('hotel', '호텔 / 숙소')}
      ${hotels
        .map(
          (h) => `
        <div class="hotel-block">
          <div class="hotel-name">${esc(h.name)}</div>
          ${h.address ? `<div class="hotel-line">${esc(h.address)}</div>` : ''}
          <div class="hotel-line">체크인/아웃: ${esc(formatStay(h))}</div>
          ${h.memo ? `<div class="hotel-memo">${esc(h.memo)}</div>` : ''}
        </div>`,
        )
        .join('')}
    </div>`;

  const mapBlock = !mapUrl
    ? ''
    : `
    <div class="ov-card" style="margin-top:12px">
      ${ovTitle('map', '여행 지도')}
      <img class="map-img" src="${esc(mapUrl)}" alt="Trip map" />
    </div>`;

  const packingBlock =
    packing.length === 0
      ? `
    <div class="ov-card" style="margin-top:12px">
      ${ovTitle('packing', '패밀리 준비물 체크리스트')}
      <p style="margin:0;font-size:13px;color:#94a3b8">일정표 정보에서 준비물을 추가하세요.</p>
    </div>`
      : `
    <div class="ov-card" style="margin-top:12px">
      ${ovTitle('packing', '패밀리 준비물 체크리스트')}
      ${[...packingByCat.entries()]
        .map(
          ([cat, list]) => `
        <div class="row"><dt>${esc(cat)}</dt><dd>${esc(
          list.map((p) => (p.checked ? `✓ ${p.text}` : p.text)).join(', '),
        )}</dd></div>`,
        )
        .join('')}
    </div>`;

  const overviewPage = `
  <section class="page">
    <div class="section-head">
      <h2>${esc(labels.overviewKo)}</h2>
      <span>${esc(labels.overviewEn)}</span>
    </div>
    <div class="accent-line"></div>
    <div class="grid2">
      <div class="ov-card">
        ${ovTitle('flight', '항공 정보')}
        ${overviewRows([['항공편', flight]])}
      </div>
      <div class="ov-card">
        ${ovTitle('emergency', '긴급 연락처')}
        <div class="row"><dt>영사콜센터</dt><dd>${esc(emergency.consular)}</dd></div>
        ${
          emergency.countries.length === 0
            ? `<p style="margin:8px 0 0;font-size:13px;color:#94a3b8">${esc(
                emergency.unresolvedHint || '',
              )}</p>`
            : emergency.countries
                .map(
                  (c) => `
          <div style="margin-top:10px;padding-top:8px;border-top:1px solid #f1f5f9">
            <div style="font-size:12px;font-weight:700;margin-bottom:4px">${esc(c.nameKo)}</div>
            <div class="row"><dt>현지 긴급</dt><dd>${esc(c.local)}</dd></div>
            <div class="row"><dt>비상 대사관</dt><dd>${esc(c.embassy)}</dd></div>
          </div>`,
                )
                .join('')
        }
      </div>
    </div>
    ${hotelBlock}
    ${mapBlock}
    ${packingBlock}
  </section>`;

  const coverImg = !cover
    ? ''
    : `<div class="cover-img-wrap"><img class="cover-img" src="${esc(cover)}" alt="" /></div>`;

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
  <style>
  /*__ITIN_EMBEDDED_FONTS__*/
  ${CSS}
  </style>
</head>
<body id="itinerary-document-root">
  <section class="page">
    <div class="badge">${esc(badge)}</div>
    <h1>${esc(trip.title)}</h1>
    ${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ''}
    ${coverImg}
    <div class="card">${metaRows}</div>
  </section>
  ${overviewPage}
  ${detailPages}
</body>
</html>`;
}
