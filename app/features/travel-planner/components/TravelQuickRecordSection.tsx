/**
 * 대시보드 — 빠른 여행 기록 위젯 (위치 / 루트 원형 버튼)
 * - kids_friendly: 전용 셸 + 모험 지도 BG (플래너 kids 배너와 분리)
 * - default (Neo Brutal) / highend_glass: content-section + 테마 CSS 원형 버튼
 */

'use client';

import type { UiTheme } from '@/lib/ui-theme';
import type { TravelTrip } from '../types';
import { TravelFieldRecordHost } from './TravelFieldRecordHost';
import type { TravelFieldRecordBarLabels } from './TravelFieldRecordBar';
import type { FieldTargetPickLabels } from './TravelFieldTargetPicker';

interface TravelQuickRecordSectionProps {
  trips: TravelTrip[];
  currentGroupId: string | null;
  uiTheme?: UiTheme;
  translations: {
    section_title: string;
    select_group: string;
    new_trip_title: string;
  };
  fieldLabels: TravelFieldRecordBarLabels;
  pickLabels?: FieldTargetPickLabels;
  onFieldSaved?: () => void;
}

export function TravelQuickRecordSection({
  trips,
  currentGroupId,
  uiTheme,
  translations: t,
  fieldLabels,
  pickLabels,
  onFieldSaved,
}: TravelQuickRecordSectionProps) {
  const isKidsTheme = uiTheme === 'kids_friendly';
  const isGlassTheme = uiTheme === 'highend_glass';
  const isNeoTheme = uiTheme === 'default';

  const body = !currentGroupId ? (
    <p
      className={
        isKidsTheme
          ? 'travel-quick-record-empty'
          : isGlassTheme
            ? 'm-0 text-slate-200/90'
            : isNeoTheme
              ? 'm-0 text-[color:var(--neo-ink)]/80'
              : 'm-0 text-[#64748b]'
      }
      style={isKidsTheme ? undefined : { fontSize: '5cqmin' }}
    >
      {t.select_group}
    </p>
  ) : (
    <TravelFieldRecordHost
      groupId={currentGroupId}
      tripId={null}
      trips={trips.map((trip) => ({
        id: trip.id,
        title: trip.title,
        start_date: trip.start_date,
        end_date: trip.end_date,
      }))}
      mode="widget"
      barLayout="circles"
      newTripTitle={t.new_trip_title}
      enableDiaryOnCreate
      enabled={Boolean(currentGroupId)}
      labels={fieldLabels}
      pickLabels={pickLabels}
      onSaved={onFieldSaved}
    />
  );

  if (isKidsTheme) {
    return (
      <section className="content-section travel-quick-record-widget travel-quick-record-widget--kids">
        <div className="travel-quick-record-stage">
          <h3 className="travel-kids-widget-title">{t.section_title}</h3>
          <div className="travel-quick-record-body">{body}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="content-section travel-quick-record-widget">
      <div className="section-header">
        <h3 className="section-title m-0 min-w-0 flex-1">{t.section_title}</h3>
      </div>
      <div className="section-body">{body}</div>
    </section>
  );
}
