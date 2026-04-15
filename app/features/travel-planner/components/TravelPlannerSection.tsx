/**
 * 가족 여행 플래너(Travel Planner) 섹션 컴포넌트
 * Dashboard용 여행 목록 카드 뷰
 */

'use client';

import React from 'react';
import { Plus } from 'lucide-react';

interface TravelTrip {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
}

interface TravelPlannerSectionProps {
  trips: TravelTrip[];
  loading: boolean;
  currentGroupId: string | null;
  onTripClick: (tripId: string) => void;
  onAddClick: () => void;
  translations: {
    section_title: string;
    add_trip: string;
    select_group: string;
    trips_loading: string;
    empty_state: string;
  };
}

export function TravelPlannerSection({
  trips,
  loading,
  currentGroupId,
  onTripClick,
  onAddClick,
  translations: t,
}: TravelPlannerSectionProps) {
  return (
    <section className="content-section">
      <div className="section-header" style={{ columnGap: '12px' }}>
        <h3 className="section-title" style={{ margin: 0, flexShrink: 0 }}>
          {t.section_title}
        </h3>
        <div aria-hidden style={{ flex: '1 1 auto', minWidth: 0 }} />
        <div style={{ flexShrink: 0, minWidth: currentGroupId ? undefined : 0 }}>
          {currentGroupId ? (
            <button
              type="button"
              onClick={onAddClick}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#9333ea',
                color: '#fff',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <Plus style={{ width: 16, height: 16 }} />
              {t.add_trip}
            </button>
          ) : null}
        </div>
      </div>
      <div className="section-body">
        {!currentGroupId ? (
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            {t.select_group}
          </div>
        ) : loading ? (
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            {t.trips_loading}
          </div>
        ) : trips.length === 0 ? (
          <div
            style={{
              fontSize: '13px',
              color: '#475569',
              lineHeight: '1.6',
              wordBreak: 'keep-all',
            }}
          >
            {t.empty_state}
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {trips.map((trip) => (
              <li
                key={trip.id}
                onClick={() => onTripClick(trip.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  marginBottom: '6px',
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#1e293b',
                }}
              >
                <div style={{ fontWeight: 600 }}>{trip.title}</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  {trip.start_date} ~ {trip.end_date}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
