'use client';

import React, { useMemo } from 'react';
import type { BabyDailyLog, BabyCheckup } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';

interface MedicalReportViewProps {
  logs: BabyDailyLog[];
  t: BabyGrowthTranslations;
  checkups?: BabyCheckup[];
}

interface TempPoint {
  time: string;
  label: string;
  value: number;
}

interface MedEvent {
  time: string;
  label: string;
  name: string;
  dose: number | null;
}

export function MedicalReportView({ logs, t, checkups }: MedicalReportViewProps) {
  const tempLogs = useMemo(
    () =>
      logs
        .filter((l) => l.log_type === 'temperature' && l.temperature_celsius != null)
        .slice(0, 48)
        .reverse(),
    [logs]
  );

  const medLogs = useMemo(
    () =>
      logs
        .filter((l) => l.log_type === 'medication' && l.medication_name)
        .slice(0, 20)
        .reverse(),
    [logs]
  );

  const tempPoints: TempPoint[] = tempLogs.map((l) => ({
    time: l.logged_at,
    label: formatTime(l.logged_at),
    value: l.temperature_celsius!,
  }));

  const medEvents: MedEvent[] = medLogs.map((l) => ({
    time: l.logged_at,
    label: formatTime(l.logged_at),
    name: l.medication_name!,
    dose: l.medication_dose_mg,
  }));

  return (
    <div className="flex flex-col gap-5 p-4 overflow-y-auto">
      <h2 className="text-base font-bold">{t.report_title}</h2>

      {/* 체온 그래프 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
          🌡️ {t.temperature_chart}
        </h3>
        {tempPoints.length === 0 ? (
          <p className="text-xs text-gray-400">{t.no_temperature_data}</p>
        ) : (
          <TempLineChart points={tempPoints} />
        )}
      </section>

      {/* 해열제 타임라인 */}
      {medEvents.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
            💊 {t.medication_timeline}
          </h3>
          <div className="space-y-2">
            {medEvents.map((ev, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20">
                <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{ev.name}</span>
                  {ev.dose != null && (
                    <span className="text-xs text-gray-500 ml-1">{ev.dose}mg</span>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0">{ev.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 영유아 검진 요약 */}
      {checkups && checkups.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
            🏥 {t.checkup_title}
          </h3>
          <div className="space-y-2">
            {checkups.slice(-5).map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-teal-50 dark:bg-teal-900/20">
                <span className="text-xs font-bold bg-teal-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                  {c.checkup_type}
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400 flex-1">
                  {new Date(c.checkup_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </span>
                <div className="flex gap-2 text-xs text-gray-500">
                  {c.weight_kg != null && <span>{c.weight_kg}kg</span>}
                  {c.height_cm != null && <span>{c.height_cm}cm</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 간단한 SVG 꺾은선 그래프 (외부 라이브러리 미사용)
// ---------------------------------------------------------------------------
function TempLineChart({ points }: { points: TempPoint[] }) {
  const W = 320;
  const H = 120;
  const PADDING = { top: 16, right: 8, bottom: 24, left: 32 };

  const values = points.map((p) => p.value);
  const minV = Math.max(35, Math.min(...values) - 0.5);
  const maxV = Math.min(42, Math.max(...values) + 0.5);
  const range = maxV - minV || 1;

  const toX = (i: number) =>
    PADDING.left + (i / Math.max(points.length - 1, 1)) * (W - PADDING.left - PADDING.right);
  const toY = (v: number) =>
    PADDING.top + (1 - (v - minV) / range) * (H - PADDING.top - PADDING.bottom);

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.value).toFixed(1)}`)
    .join(' ');

  // 발열 기준선 (38.0°C)
  const feverY = toY(38.0);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="text-blue-500"
        style={{ minWidth: W }}
        aria-label="체온 그래프"
      >
        {/* 발열 기준선 */}
        {feverY > PADDING.top && feverY < H - PADDING.bottom && (
          <>
            <line
              x1={PADDING.left}
              y1={feverY}
              x2={W - PADDING.right}
              y2={feverY}
              stroke="#f97316"
              strokeWidth={1}
              strokeDasharray="4 2"
              opacity={0.6}
            />
            <text x={PADDING.left - 2} y={feverY - 3} fontSize={9} fill="#f97316" textAnchor="end">
              38°
            </text>
          </>
        )}

        {/* Y축 레이블 */}
        {[minV, (minV + maxV) / 2, maxV].map((v) => (
          <text
            key={v}
            x={PADDING.left - 4}
            y={toY(v) + 4}
            fontSize={9}
            fill="#9ca3af"
            textAnchor="end"
          >
            {v.toFixed(1)}
          </text>
        ))}

        {/* 꺾은선 */}
        <path d={pathD} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />

        {/* 데이터 점 + 시간 레이블 */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(p.value)} r={3} fill="currentColor" />
            {/* 첫/마지막 레이블만 표시 */}
            {(i === 0 || i === points.length - 1) && (
              <text
                x={toX(i)}
                y={H - 4}
                fontSize={8}
                fill="#9ca3af"
                textAnchor="middle"
              >
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
