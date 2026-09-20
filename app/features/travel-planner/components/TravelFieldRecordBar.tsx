/**
 * Field record bar.
 * - circles: 빠른 여행 기록 위젯용 원형 버튼
 * - default: 플래너/다이어리 상세 페이지용 가로 버튼
 */

'use client';

import { MapPin, Navigation, Square } from 'lucide-react';

export type TravelFieldRecordBarLabels = {
  checkin: string;
  route_start: string;
  route_stop: string;
  need_active_trip: string;
  recording: string;
  /** C1: keep screen/app foreground while recording */
  recording_keep_open?: string;
};

type Props = {
  mode: 'widget' | 'page';
  layout?: 'default' | 'circles';
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
  layout = 'default',
  disabled,
  busy,
  recording,
  message,
  error,
  labels,
  onCheckIn,
  onToggleRoute,
}: Props) {
  if (layout === 'circles') {
    const circleBtn =
      'travel-quick-record-circle inline-flex aspect-square w-[min(43cqmin,10.25rem)] max-h-[min(43cqmin,10.25rem)] min-w-[6.75rem] shrink-0 cursor-pointer flex-col items-center justify-center gap-[1.2cqmin] overflow-visible border-0 px-[2cqmin] text-center font-bold transition-[transform,box-shadow,background-color] disabled:cursor-not-allowed disabled:opacity-55';
    const iconCls =
      'travel-quick-record-circle-icon h-[clamp(1.08rem,7.6cqmin,2.2rem)] w-[clamp(1.08rem,7.6cqmin,2.2rem)] shrink-0';
    const labelCls =
      'travel-quick-record-circle-label max-w-[95%] px-0.5 text-[clamp(0.74rem,5.8cqmin,1.02rem)] leading-snug [overflow-wrap:anywhere] [word-break:keep-all]';

    return (
      <div className="flex w-full min-w-0 flex-col gap-[1.5cqmin]" data-travel-field-bar="circles">
        <div className="travel-quick-record-circle-row flex w-full min-w-0 items-center justify-center gap-[3.5cqmin] py-[0.5cqmin]">
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
          <div className="flex flex-col gap-[0.6cqmin]">
            <p className="travel-quick-record-status m-0 text-center text-[3.8cqmin] font-semibold">
              {labels.recording}
            </p>
            {labels.recording_keep_open ? (
              <p className="travel-quick-record-hint m-0 text-center text-[3.4cqmin] leading-snug [word-break:keep-all]">
                {labels.recording_keep_open}
              </p>
            ) : null}
          </div>
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

  return (
    <div className="mt-3 flex w-full min-w-0 flex-col gap-2" data-travel-field-bar={mode}>
      <div className="grid w-full min-w-0 grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCheckIn}
          disabled={busy || disabled}
          className="inline-flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-0 bg-emerald-600 px-2.5 py-2.5 text-[12px] font-semibold leading-snug text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-55 sm:px-3 sm:text-[13px]"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 text-center [overflow-wrap:anywhere] [word-break:keep-all]">
            {labels.checkin}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleRoute}
          disabled={busy || disabled}
          className={`inline-flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-0 px-2.5 py-2.5 text-[12px] font-semibold leading-snug text-white transition-colors disabled:cursor-not-allowed disabled:opacity-55 sm:px-3 sm:text-[13px] ${
            recording ? 'bg-rose-600 hover:bg-rose-700' : 'bg-violet-600 hover:bg-violet-700'
          }`}
        >
          {recording ? (
            <Square className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <Navigation className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <span className="min-w-0 text-center [overflow-wrap:anywhere] [word-break:keep-all]">
            {recording ? labels.route_stop : labels.route_start}
          </span>
        </button>
      </div>
      {disabled ? (
        <p className="m-0 text-xs leading-snug text-slate-500">{labels.need_active_trip}</p>
      ) : null}
      {recording && !disabled ? (
        <div className="flex flex-col gap-0.5">
          <p className="m-0 text-xs font-semibold text-rose-600">{labels.recording}</p>
          {labels.recording_keep_open ? (
            <p className="m-0 text-[11px] leading-snug text-slate-500 [word-break:keep-all]">
              {labels.recording_keep_open}
            </p>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="m-0 text-xs font-medium text-emerald-700">{message}</p> : null}
      {error ? <p className="m-0 text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
