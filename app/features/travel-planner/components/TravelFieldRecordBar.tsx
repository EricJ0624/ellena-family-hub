/**
 * One-tap field record bar.
 * - page: larger buttons
 * - widget: default full-width
 * - widget + toolbar: Import/Add 와 같은 필 툴바용 (일정 목록과 분리)
 * - circles: 빠른 여행 기록 위젯용 원형 버튼
 */

'use client';

import React from 'react';
import { MapPin, Navigation, Square } from 'lucide-react';

export type TravelFieldRecordBarLabels = {
  checkin: string;
  route_start: string;
  route_stop: string;
  need_active_trip: string;
  recording: string;
};

type Props = {
  mode: 'widget' | 'page';
  /** widget only: render as compact pills for toolbar next to Import/Add */
  toolbar?: boolean;
  layout?: 'default' | 'toolbar' | 'circles';
  disabled?: boolean;
  busy?: boolean;
  recording?: boolean;
  message?: string | null;
  error?: string | null;
  labels: TravelFieldRecordBarLabels;
  onCheckIn: () => void;
  onToggleRoute: () => void;
};

export function TravelFieldRecordBar({
  mode,
  toolbar = false,
  layout,
  disabled,
  busy,
  recording,
  message,
  error,
  labels,
  onCheckIn,
  onToggleRoute,
}: Props) {
  const isWidget = mode === 'widget';
  const resolvedLayout = layout ?? (isWidget && toolbar ? 'toolbar' : 'default');

  if (resolvedLayout === 'toolbar') {
    return (
      <div className="contents" data-travel-field-bar="toolbar">
        <button
          type="button"
          onClick={onCheckIn}
          disabled={busy || disabled}
          className="travel-kids-widget-field-checkin"
          title={disabled ? labels.need_active_trip : labels.checkin}
        >
          <MapPin className="travel-kids-widget-add-icon" aria-hidden />
          <span>{labels.checkin}</span>
        </button>
        <button
          type="button"
          onClick={onToggleRoute}
          disabled={busy || disabled}
          className={
            recording ? 'travel-kids-widget-field-route-stop' : 'travel-kids-widget-field-route'
          }
          title={disabled ? labels.need_active_trip : recording ? labels.route_stop : labels.route_start}
        >
          {recording ? (
            <Square className="travel-kids-widget-add-icon" aria-hidden />
          ) : (
            <Navigation className="travel-kids-widget-add-icon" aria-hidden />
          )}
          <span>{recording ? labels.route_stop : labels.route_start}</span>
        </button>
        {disabled ? (
          <span className="travel-kids-widget-field-hint">{labels.need_active_trip}</span>
        ) : null}
        {recording && !disabled ? (
          <span className="travel-kids-widget-field-hint travel-kids-widget-field-hint--rec">
            {labels.recording}
          </span>
        ) : null}
        {message ? <span className="travel-kids-widget-field-hint travel-kids-widget-field-hint--ok">{message}</span> : null}
        {error ? <span className="travel-kids-widget-field-hint travel-kids-widget-field-hint--err">{error}</span> : null}
      </div>
    );
  }

  if (resolvedLayout === 'circles') {
    const circleBtn =
      'travel-quick-record-circle inline-flex aspect-square w-[min(28cqmin,7.5rem)] shrink-0 cursor-pointer flex-col items-center justify-center gap-[1.5cqmin] border-0 px-[2cqmin] text-center font-bold transition-[transform,box-shadow,background-color] disabled:cursor-not-allowed disabled:opacity-55';
    const iconCls = 'travel-quick-record-circle-icon h-[7cqmin] w-[7cqmin] max-h-7 max-w-7 shrink-0';
    const labelCls =
      'travel-quick-record-circle-label max-w-full text-[3.6cqmin] leading-tight [word-break:keep-all]';

    return (
      <div className="flex w-full min-w-0 flex-col gap-[1.5cqmin]" data-travel-field-bar="circles">
        <div className="flex w-full min-w-0 items-center justify-evenly gap-[2cqmin] py-[1cqmin]">
          <button
            type="button"
            onClick={onCheckIn}
            disabled={busy || disabled}
            className={`${circleBtn} travel-quick-record-circle--checkin`}
            title={disabled ? labels.need_active_trip : labels.checkin}
          >
            <MapPin className={iconCls} aria-hidden />
            <span className={labelCls}>{labels.checkin}</span>
          </button>
          <button
            type="button"
            onClick={onToggleRoute}
            disabled={busy || disabled}
            className={`${circleBtn} ${
              recording
                ? 'travel-quick-record-circle--recording'
                : 'travel-quick-record-circle--route'
            }`}
            title={disabled ? labels.need_active_trip : recording ? labels.route_stop : labels.route_start}
          >
            {recording ? (
              <Square className={iconCls} aria-hidden />
            ) : (
              <Navigation className={iconCls} aria-hidden />
            )}
            <span className={labelCls}>{recording ? labels.route_stop : labels.route_start}</span>
          </button>
        </div>
        {disabled ? (
          <p className="travel-quick-record-hint m-0 text-center text-[3.8cqmin] leading-snug [word-break:keep-all]">
            {labels.need_active_trip}
          </p>
        ) : null}
        {recording && !disabled ? (
          <p className="travel-quick-record-status m-0 text-center text-[3.8cqmin] font-semibold">
            {labels.recording}
          </p>
        ) : null}
        {message ? (
          <p className="travel-quick-record-ok m-0 text-center text-[3.8cqmin] font-medium">{message}</p>
        ) : null}
        {error ? (
          <p className="travel-quick-record-err m-0 text-center text-[3.8cqmin] font-medium">{error}</p>
        ) : null}
      </div>
    );
  }

  const wrapClass = isWidget
    ? 'mt-[1.5cqmin] flex w-full min-w-0 flex-col gap-[1cqmin]'
    : 'mt-3 flex w-full min-w-0 flex-col gap-2';

  const rowClass = isWidget
    ? 'flex w-full min-w-0 flex-wrap gap-[1.5cqmin]'
    : 'flex w-full min-w-0 flex-wrap gap-2';

  const btnBase = isWidget
    ? 'inline-flex min-w-0 flex-1 cursor-pointer items-center justify-center rounded-lg border-0 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-55'
    : 'inline-flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-0 px-3 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 sm:flex-none';

  const btnStyle = isWidget
    ? ({ gap: '1cqmin', padding: '2cqmin 2.5cqmin', fontSize: '4.5cqmin' } as React.CSSProperties)
    : undefined;

  const iconStyle = isWidget
    ? ({ width: '4.5cqmin', height: '4.5cqmin', flexShrink: 0 } as React.CSSProperties)
    : undefined;

  const hintClass = isWidget
    ? 'm-0 text-[3.8cqmin] leading-snug text-slate-500 [word-break:keep-all]'
    : 'm-0 text-xs leading-snug text-slate-500';

  const statusClass = isWidget
    ? 'm-0 text-[3.8cqmin] font-semibold text-rose-600'
    : 'm-0 text-xs font-semibold text-rose-600';

  const okClass = isWidget
    ? 'm-0 text-[3.8cqmin] font-medium text-emerald-700'
    : 'm-0 text-xs font-medium text-emerald-700';

  const errClass = isWidget
    ? 'm-0 text-[3.8cqmin] font-medium text-red-700'
    : 'm-0 text-xs font-medium text-red-700';

  return (
    <div className={wrapClass} data-travel-field-bar={mode}>
      <div className={rowClass}>
        <button
          type="button"
          onClick={onCheckIn}
          disabled={busy || disabled}
          className={`${btnBase} bg-emerald-600 text-white hover:bg-emerald-700`}
          style={btnStyle}
        >
          <MapPin className={isWidget ? undefined : 'h-3.5 w-3.5 shrink-0'} style={iconStyle} aria-hidden />
          <span className="truncate">{labels.checkin}</span>
        </button>
        <button
          type="button"
          onClick={onToggleRoute}
          disabled={busy || disabled}
          className={`${btnBase} ${
            recording
              ? 'bg-rose-600 text-white hover:bg-rose-700'
              : 'bg-violet-600 text-white hover:bg-violet-700'
          }`}
          style={btnStyle}
        >
          {recording ? (
            <Square className={isWidget ? undefined : 'h-3.5 w-3.5 shrink-0'} style={iconStyle} aria-hidden />
          ) : (
            <Navigation className={isWidget ? undefined : 'h-3.5 w-3.5 shrink-0'} style={iconStyle} aria-hidden />
          )}
          <span className="truncate">{recording ? labels.route_stop : labels.route_start}</span>
        </button>
      </div>
      {disabled ? <p className={hintClass}>{labels.need_active_trip}</p> : null}
      {recording && !disabled ? <p className={statusClass}>{labels.recording}</p> : null}
      {message ? <p className={okClass}>{message}</p> : null}
      {error ? <p className={errClass}>{error}</p> : null}
    </div>
  );
}
