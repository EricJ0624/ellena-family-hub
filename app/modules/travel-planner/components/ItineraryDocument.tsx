'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { TravelAccommodation, TravelEmergencyContacts, TravelPackingItem, TravelTrip } from '@/lib/modules/travel-planner/types';
import {
  buildAutoFlightSummary,
  formatTripDurationKo,
  normalizeEmergencyContacts,
  normalizePackingChecklist,
  resolveCoverBadge,
} from '@/lib/modules/travel-planner/document-meta';
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
  }>;
  dayTitles: Record<string, string>;
  labels: ItineraryDocumentLabels;
  /** 인쇄/PDF용 루트 id */
  rootId?: string;
};

function AccentBar() {
  return <span className="inline-block h-4 w-1 shrink-0 rounded-sm bg-[var(--itin-accent)]" aria-hidden />;
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
  if (!value.trim()) return null;
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-b-0">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase">{label}</div>
        <div className="mt-0.5 text-[15px] font-bold text-slate-800">{value}</div>
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
  const visible = rows.filter((r) => r.value.trim());
  if (visible.length === 0) return null;
  return (
    <section className="break-inside-avoid rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-slate-800">
        <AccentBar />
        <span>
          {emoji} {title}
        </span>
      </h3>
      <dl className="m-0">
        {visible.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[7.5rem_1fr] gap-2 border-b border-slate-100 py-2.5 text-[13px] last:border-b-0"
          >
            <dt className="font-medium text-slate-400">{r.label}</dt>
            <dd className="m-0 font-semibold text-slate-800">{r.value}</dd>
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

export function ItineraryDocument({
  trip,
  items,
  accommodations,
  transports,
  dayTitles,
  labels,
  rootId = 'itinerary-document-root',
}: Props) {
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

  const hasOverview =
    Boolean(flight || hotelName || emergency.local || emergency.consular || emergency.embassy || packing.length > 0);

  return (
    <div
      id={rootId}
      className="itin-document mx-auto max-w-[210mm] bg-[var(--itin-bg)] text-slate-800 antialiased"
      style={
        {
          ['--itin-bg' as string]: '#F7F5F2',
          ['--itin-accent' as string]: '#D88C75',
        } as CSSProperties
      }
    >
      {/* Cover */}
      <section className="break-after-page px-8 py-10 sm:px-12 sm:py-14">
        <div className="inline-block rounded-md bg-[var(--itin-accent)] px-3 py-1 text-[11px] font-bold tracking-wide text-white">
          {badge}
        </div>
        <h1 className="mt-5 text-3xl leading-tight font-bold text-slate-900 sm:text-4xl">{trip.title}</h1>
        {subtitle ? <p className="mt-3 text-base text-slate-500 sm:text-lg">{subtitle}</p> : null}

        <div className="mt-10 rounded-2xl border border-slate-100 bg-white px-5 py-2 shadow-sm">
          <MetaRow icon={<Calendar className="h-5 w-5 text-rose-500" />} label="TRIP DURATION" value={duration} />
          <MetaRow icon={<Users className="h-5 w-5 text-sky-600" />} label="TRAVELERS" value={travelers} />
          <MetaRow icon={<Sparkles className="h-5 w-5 text-amber-500" />} label="MAIN THEME" value={theme} />
        </div>
      </section>

      {/* Overview */}
      {hasOverview ? (
        <section className="break-after-page px-8 py-10 sm:px-12">
          <div className="mb-2 flex items-end justify-between gap-3">
            <h2 className="m-0 text-xl font-bold text-slate-900">{labels.overviewKo}</h2>
            <span className="text-xs text-slate-400">{labels.overviewEn}</span>
          </div>
          <div className="mb-6 h-px bg-[var(--itin-accent)]" />

          <div className="grid gap-4 md:grid-cols-2">
            <OverviewCard
              title="항공 및 호텔 정보"
              emoji="✈️"
              rows={[
                { label: '항공편', value: flight },
                { label: '숙소', value: hotelName },
                { label: '체크인', value: checkIn },
              ]}
            />
            <OverviewCard
              title="긴급 연락처"
              emoji="🚨"
              rows={[
                { label: '현지 긴급', value: emergency.local ?? '' },
                { label: '영사콜센터', value: emergency.consular ?? '' },
                { label: '비상 대사관', value: emergency.embassy ?? '' },
              ]}
            />
          </div>

          {packing.length > 0 ? (
            <section className="mt-4 break-inside-avoid rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-slate-800">
                <AccentBar />
                <span>🎒 패밀리 준비물 체크리스트</span>
              </h3>
              <dl className="m-0">
                {[...packingByCat.entries()].map(([cat, list]) => (
                  <div
                    key={cat}
                    className="grid grid-cols-[7.5rem_1fr] gap-2 border-b border-slate-100 py-2.5 text-[13px] last:border-b-0"
                  >
                    <dt className="font-medium text-slate-400">{cat}</dt>
                    <dd className="m-0 font-semibold text-slate-800">
                      {list.map((p) => (p.checked ? `✓ ${p.text}` : p.text)).join(', ')}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </section>
      ) : null}

      {/* Details — chunk days in pairs for visual pages */}
      {(() => {
        const activeDays = days.filter((d) => (byDay.get(d) ?? []).length > 0 || (dayTitles[d] ?? '').trim());
        const chunks: string[][] = [];
        for (let i = 0; i < activeDays.length; i += 2) {
          chunks.push(activeDays.slice(i, i + 2));
        }
        if (chunks.length === 0) {
          return (
            <section className="px-8 py-10 sm:px-12">
              <div className="mb-2 flex items-end justify-between gap-3">
                <h2 className="m-0 text-xl font-bold text-slate-900">{labels.detailsKo}</h2>
                <span className="text-xs text-slate-400">{labels.detailsEn}</span>
              </div>
              <div className="mb-6 h-px bg-[var(--itin-accent)]" />
              <p className="text-sm text-slate-400">등록된 상세 일정이 없습니다.</p>
            </section>
          );
        }
        return chunks.map((chunk, ci) => {
          const dayNums = chunk.map((d) => days.indexOf(d) + 1);
          const rangeLabel =
            dayNums.length === 1 ? `Day ${dayNums[0]}` : `Day ${dayNums[0]} - Day ${dayNums[dayNums.length - 1]}`;
          return (
            <section key={`chunk-${ci}`} className="break-after-page px-8 py-10 sm:px-12 last:break-after-auto">
              <div className="mb-2 flex items-end justify-between gap-3">
                <h2 className="m-0 text-xl font-bold text-slate-900">
                  {labels.detailsKo} ({rangeLabel})
                </h2>
                <span className="text-xs text-slate-400">{labels.detailsEn}</span>
              </div>
              <div className="mb-6 h-px bg-[var(--itin-accent)]" />

              <div className="flex flex-col gap-4">
                {chunk.map((dayYmd) => {
                  const dayNum = days.indexOf(dayYmd) + 1;
                  const dayTitle = (dayTitles[dayYmd] ?? '').trim();
                  const dayItems = byDay.get(dayYmd) ?? [];
                  return (
                    <article
                      key={dayYmd}
                      className="break-inside-avoid rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                    >
                      <h3 className="mb-4 flex items-center gap-2 text-[15px] font-bold text-slate-900">
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
                                {time ? (
                                  <div className="text-[13px] font-semibold text-[var(--itin-accent)]">{time}</div>
                                ) : null}
                                <div className="mt-0.5 text-[15px] font-bold text-slate-800">{title}</div>
                                {it.description ? (
                                  <div className="mt-1 text-[13px] leading-relaxed text-slate-500">{it.description}</div>
                                ) : null}
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
