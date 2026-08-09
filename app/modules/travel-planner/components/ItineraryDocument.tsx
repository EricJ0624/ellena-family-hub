'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { TravelAccommodation, TravelEmergencyContacts, TravelPackingItem, TravelTrip } from '@/lib/modules/travel-planner/types';
import {
  buildAutoFlightSummary,
  formatTripDurationKo,
  formatTravelersFromNames,
  normalizePackingChecklist,
  resolveCoverBadge,
} from '@/lib/modules/travel-planner/document-meta';
import { resolveEmergencyForDocument } from '@/lib/modules/travel-planner/emergency-contacts-auto';
import { shortItineraryTitle } from '@/lib/modules/travel-planner/short-itinerary-title';
import { enumerateTripDays } from '@/lib/modules/travel-planner/itinerary-display-expand';
import { Calendar, Sparkles, Users } from 'lucide-react';

export type ItineraryDocumentItem = {
  type: 'accommodation' | 'dining' | 'attraction' | 'transport' | 'other';
  day_date: string;
  start_time?: string | null;
  end_time?: string | null;
  title: string;
  description?: string | null;
  address?: string | null;
  transport_type?: 'air' | 'train' | 'car' | 'bike';
};

export type ItineraryDocumentLabels = {
  overviewKo: string;
  overviewEn: string;
  detailsKo: string;
  detailsEn: string;
};

type Props = {
  trip: TravelTrip;
  items: ItineraryDocumentItem[];
  accommodations: TravelAccommodation[];
  transports: Array<{
    transport_type: string;
    departure?: string | null;
    arrival?: string | null;
    day_date?: string;
    end_day_date?: string | null;
    memo?: string | null;
  }>;
  dayTitles: Record<string, string>;
  labels: ItineraryDocumentLabels;
  /** 그룹 멤버 표시명 (TRAVELERS 자동) */
  travelerNames?: string[];
  /** 여행 참가자 국적 ISO (대사관 선택) */
  travelerNationalities?: string[];
  /** 여행 첨부 첫 장 등 표지 이미지 */
  coverImageUrl?: string | null;
  /** Static Maps 이미지 URL */
  mapImageUrl?: string | null;
  rootId?: string;
};

function AccentBar() {
  return <span className="itin-accent-bar" aria-hidden />;
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  const display = value.trim() || '—';
  return (
    <div className="itin-meta-row">
      <div className="itin-meta-icon">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="itin-meta-label">{label}</div>
        <div className={`itin-meta-value${value.trim() ? '' : ' text-slate-400'}`}>{display}</div>
      </div>
    </div>
  );
}

function OverviewCard({
  title,
  emoji,
  rows,
}: {
  title: string;
  emoji: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="itin-card break-inside-avoid">
      <h3 className="itin-card-title">
        <AccentBar />
        <span>
          {emoji} {title}
        </span>
      </h3>
      <dl className="m-0">
        {rows.map((r) => (
          <div key={r.label} className="itin-kv-row">
            <dt className="itin-kv-label">{r.label}</dt>
            <dd className={`itin-kv-value${r.value.trim() ? '' : ' text-slate-400'}`}>
              {r.value.trim() || '—'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function formatTimeRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return '';
  return `${start || '--'} - ${end || '--'}`;
}

function formatStay(a: TravelAccommodation): string {
  const cin = a.check_in_time?.trim()
    ? `${a.check_in_date} ${a.check_in_time}`
    : a.check_in_date;
  const cout = a.check_out_time?.trim()
    ? `${a.check_out_date} ${a.check_out_time}`
    : a.check_out_date;
  return `${cin} → ${cout}`;
}

export function ItineraryDocument({
  trip,
  items,
  accommodations,
  transports,
  dayTitles,
  labels,
  travelerNames,
  travelerNationalities,
  coverImageUrl,
  mapImageUrl,
  rootId = 'itinerary-document-root',
}: Props) {
  const badge = resolveCoverBadge(trip);
  const duration = formatTripDurationKo(trip.start_date, trip.end_date);
  const travelers = formatTravelersFromNames(travelerNames ?? []);
  const theme = (trip.theme ?? '').trim();
  const subtitle = (trip.subtitle ?? '').trim();
  const emergency = resolveEmergencyForDocument({
    destination: trip.destination,
    stored: trip.emergency_contacts as TravelEmergencyContacts | null,
    travelerNationalities,
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
  const cover = (coverImageUrl ?? '').trim();
  const mapUrl = (mapImageUrl ?? '').trim();

  const days = enumerateTripDays(trip.start_date, trip.end_date);
  const byDay = new Map<string, ItineraryDocumentItem[]>();
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

  return (
    <div
      id={rootId}
      className="itin-document mx-auto max-w-[210mm] text-slate-800 antialiased"
      style={
        {
          ['--itin-bg' as string]: 'var(--itin-doc-bg, #F7F5F2)',
          ['--itin-accent' as string]: 'var(--itin-doc-accent, #D88C75)',
        } as CSSProperties
      }
    >
      {/* Cover */}
      <section className="itin-page break-after-page">
        <div className="itin-badge">{badge}</div>
        <h1 className="itin-cover-title">{trip.title}</h1>
        {subtitle ? <p className="itin-cover-sub">{subtitle}</p> : null}

        {cover ? (
          <div className="itin-cover-image-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" className="itin-cover-image" />
          </div>
        ) : null}

        <div className="itin-card itin-meta-card">
          <MetaRow icon={<Calendar className="h-5 w-5 text-rose-500" />} label="TRIP DURATION" value={duration} />
          <MetaRow icon={<Users className="h-5 w-5 text-sky-600" />} label="TRAVELERS" value={travelers} />
          <MetaRow icon={<Sparkles className="h-5 w-5 text-amber-500" />} label="MAIN THEME" value={theme} />
        </div>
      </section>

      {/* Overview */}
      <section className="itin-page break-after-page">
          <div className="itin-section-head">
            <h2 className="itin-section-title">{labels.overviewKo}</h2>
            <span className="itin-section-en">{labels.overviewEn}</span>
          </div>
          <div className="itin-accent-line" />

          <div className="itin-grid-2">
            <OverviewCard
              title="항공 정보"
              emoji="✈️"
              rows={[{ label: '항공편', value: flight }]}
            />
            <section className="itin-card break-inside-avoid">
              <h3 className="itin-card-title">
                <AccentBar />
                <span>🚨 긴급 연락처</span>
              </h3>
              <dl className="m-0">
                <div className="itin-kv-row">
                  <dt className="itin-kv-label">영사콜센터</dt>
                  <dd className="itin-kv-value">{emergency.consular}</dd>
                </div>
              </dl>
              {emergency.countries.length > 0 ? (
                <div className="mt-3 flex flex-col gap-3">
                  {emergency.countries.map((c) => (
                    <div key={c.code} className="rounded-lg border border-slate-100 bg-white/60 px-3 py-2">
                      <div className="mb-1 text-[12px] font-bold text-slate-700">{c.nameKo}</div>
                      <dl className="m-0">
                        <div className="itin-kv-row">
                          <dt className="itin-kv-label">현지 긴급</dt>
                          <dd className="itin-kv-value">{c.local}</dd>
                        </div>
                        <div className="itin-kv-row">
                          <dt className="itin-kv-label">비상 대사관</dt>
                          <dd className="itin-kv-value">{c.embassy}</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 mb-0 text-sm text-slate-400">{emergency.unresolvedHint}</p>
              )}
            </section>
          </div>

          {hotels.length > 0 ? (
            <section className="itin-card mt-4 break-inside-avoid">
              <h3 className="itin-card-title">
                <AccentBar />
                <span>🏨 호텔 / 숙소</span>
              </h3>
              <div className="flex flex-col gap-4">
                {hotels.map((h) => (
                  <div key={h.id} className="itin-hotel-block">
                    <div className="itin-hotel-name">{h.name}</div>
                    {h.address ? <div className="itin-hotel-line">{h.address}</div> : null}
                    <div className="itin-hotel-line">체크인/아웃: {formatStay(h)}</div>
                    {h.memo ? <div className="itin-hotel-memo">{h.memo}</div> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="itin-card mt-4 break-inside-avoid">
              <h3 className="itin-card-title">
                <AccentBar />
                <span>🏨 호텔 / 숙소</span>
              </h3>
              <p className="m-0 text-sm text-slate-400">숙소 메뉴에서 등록하면 여기에 표시됩니다.</p>
            </section>
          )}

          {mapUrl ? (
            <section className="itin-card mt-4 break-inside-avoid">
              <h3 className="itin-card-title">
                <AccentBar />
                <span>🗺️ 여행 지도</span>
              </h3>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mapUrl} alt="Trip map" className="itin-map-image" />
            </section>
          ) : null}

          <section className="itin-card mt-4 break-inside-avoid">
            <h3 className="itin-card-title">
              <AccentBar />
              <span>🎒 패밀리 준비물 체크리스트</span>
            </h3>
            {packing.length > 0 ? (
              <dl className="m-0">
                {[...packingByCat.entries()].map(([cat, list]) => (
                  <div key={cat} className="itin-kv-row">
                    <dt className="itin-kv-label">{cat}</dt>
                    <dd className="itin-kv-value">
                      {list.map((p) => (p.checked ? `✓ ${p.text}` : p.text)).join(', ')}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="m-0 text-sm text-slate-400">일정표 정보에서 준비물을 추가하세요.</p>
            )}
          </section>
        </section>

      {/* Details */}
      {(() => {
        const activeDays = days.filter((d) => (byDay.get(d) ?? []).length > 0 || (dayTitles[d] ?? '').trim());
        const chunks: string[][] = [];
        for (let i = 0; i < activeDays.length; i += 2) {
          chunks.push(activeDays.slice(i, i + 2));
        }
        if (chunks.length === 0) {
          return (
            <section className="itin-page">
              <div className="itin-section-head">
                <h2 className="itin-section-title">{labels.detailsKo}</h2>
                <span className="itin-section-en">{labels.detailsEn}</span>
              </div>
              <div className="itin-accent-line" />
              <p className="text-sm text-slate-400">등록된 상세 일정이 없습니다.</p>
            </section>
          );
        }
        return chunks.map((chunk, ci) => {
          const dayNums = chunk.map((d) => days.indexOf(d) + 1);
          const rangeLabel =
            dayNums.length === 1 ? `Day ${dayNums[0]}` : `Day ${dayNums[0]} - Day ${dayNums[dayNums.length - 1]}`;
          return (
            <section key={`chunk-${ci}`} className="itin-page break-after-page last:break-after-auto">
              <div className="itin-section-head">
                <h2 className="itin-section-title">
                  {labels.detailsKo} ({rangeLabel})
                </h2>
                <span className="itin-section-en">{labels.detailsEn}</span>
              </div>
              <div className="itin-accent-line" />

              <div className="flex flex-col gap-4">
                {chunk.map((dayYmd) => {
                  const dayNum = days.indexOf(dayYmd) + 1;
                  const dayTitle = (dayTitles[dayYmd] ?? '').trim();
                  const dayItems = byDay.get(dayYmd) ?? [];
                  return (
                    <article key={dayYmd} className="itin-card break-inside-avoid">
                      <h3 className="itin-card-title">
                        <AccentBar />
                        <span>
                          ☀️ Day {dayNum}
                          {dayTitle ? ` : ${dayTitle}` : ''}
                        </span>
                      </h3>
                      <div className="flex flex-col gap-5">
                        {dayItems.length === 0 ? (
                          <p className="text-sm text-slate-400">이 날 일정 없음</p>
                        ) : (
                          dayItems.map((it, idx) => {
                            const time = formatTimeRange(it.start_time, it.end_time);
                            const title = shortItineraryTitle(it.type, it.title, it.address);
                            return (
                              <div key={`${dayYmd}-${idx}-${title}`}>
                                {time ? <div className="itin-slot-time">{time}</div> : null}
                                <div className="itin-slot-title">{title}</div>
                                {it.description ? <div className="itin-slot-desc">{it.description}</div> : null}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        });
      })()}
    </div>
  );
}
