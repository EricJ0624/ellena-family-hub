'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LangCode } from '@/lib/language-fonts';
import type { UiTheme } from '@/lib/ui-theme';
import { useHorizontalPageSwipe } from '@/lib/hooks/useHorizontalPageSwipe';
import { listAttachments } from '@/lib/feature-attachments-client';
import {
  forgetFamilyLogAttachments,
  readFamilyLogAttachments,
  writeFamilyLogAttachments,
} from '../attachment-cache';
import { familyLogAuthHeaders } from '../client-auth';
import { FamilyLogCardEditor } from './FamilyLogCardEditor';
import { FamilyLogCardView } from './FamilyLogCardView';
import {
  familyLogCheckinFallback,
  familyLogRouteTitle,
  getFamilyLogLabels,
} from '../labels';
import type { FamilyLogCard, FamilyLogGrain } from '../types';

const BG_SRC = '/family-log/family-log-title.png';
const CARD_PX = 88;
const GAP_PX = 8;

type RoutePoint = { latitude: number; longitude: number; recorded_at: string };

type Props = {
  currentGroupId: string | null;
  lang: LangCode;
  uiTheme?: UiTheme;
};

function localDay(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function localHm(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function trackRoute(points: { current: RoutePoint[] }): number {
  return navigator.geolocation.watchPosition(
    (next) => {
      points.current.push({
        latitude: next.coords.latitude,
        longitude: next.coords.longitude,
        recorded_at: new Date().toISOString(),
      });
    },
    () => undefined,
    { enableHighAccuracy: true, maximumAge: 5000 },
  );
}

function cardSignature(list: FamilyLogCard[]): string {
  return list
    .map((card) =>
      [
        card.id,
        card.updated_at,
        card.day_date,
        card.title,
        card.note ?? '',
        card.mood_tags.join(''),
        card.amount ?? '',
        card.currency ?? '',
        card.show_map ? '1' : '0',
        card.collage_style ?? '',
        card.rating ?? '',
        card.is_revisit ? '1' : '0',
      ].join('\u001f'),
    )
    .join('\u001e');
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('geo'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 5000,
    });
  });
}

function matchesGrain(card: FamilyLogCard, grain: FamilyLogGrain, cursor: string): boolean {
  if (grain === 'recent') return true;
  if (grain === 'day') return card.day_date === cursor;
  if (grain === 'month') return card.day_date.slice(0, 7) === cursor;
  return card.day_date.slice(0, 4) === cursor;
}

function byCreatedAt(a: FamilyLogCard, b: FamilyLogCard, direction: 'asc' | 'desc'): number {
  const cmp = a.created_at.localeCompare(b.created_at);
  if (cmp !== 0) return direction === 'asc' ? cmp : -cmp;
  return a.id.localeCompare(b.id);
}

export function FamilyLogSection({ currentGroupId, lang, uiTheme }: Props) {
  const labels = getFamilyLogLabels(lang);
  const illustrated = uiTheme !== 'default' && uiTheme !== 'highend_glass';
  const isNeo = uiTheme === 'default';
  const [cards, setCards] = useState<FamilyLogCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grain, setGrain] = useState<FamilyLogGrain>('recent');
  const [cursor, setCursor] = useState(localDay());
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(2);
  const [recording, setRecording] = useState(false);
  const [viewing, setViewing] = useState<FamilyLogCard | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const areaRef = useRef<HTMLDivElement | null>(null);
  const watchRef = useRef<number | null>(null);
  const pointsRef = useRef<RoutePoint[]>([]);
  const startHmRef = useRef('');
  const startDayRef = useRef('');

  const loadCards = useCallback(async (groupId: string) => {
    setLoading(true);
    try {
      const headers = await familyLogAuthHeaders();
      const res = await fetch(`/api/v1/family-log/cards?groupId=${encodeURIComponent(groupId)}`, {
        headers,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'load');
      const next = Array.isArray(json.data) ? (json.data as FamilyLogCard[]) : [];
      setCards((prev) => (cardSignature(prev) === cardSignature(next) ? prev : next));
    } catch {
      setError(labels.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [labels.loadFailed]);

  useEffect(() => {
    if (!currentGroupId) {
      setCards([]);
      return;
    }
    void loadCards(currentGroupId);
  }, [currentGroupId, loadCards]);

  useEffect(() => {
    return () => {
      if (watchRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => {
      const height = el.clientHeight;
      if (height < 12) return;
      const fit = Math.floor((height + GAP_PX) / (CARD_PX + GAP_PX));
      const next = Math.max(1, fit);
      setRows((prev) => (prev === next ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [currentGroupId]);

  const visible = useMemo(() => {
    const filtered = cards.filter((card) => matchesGrain(card, grain, cursor));
    const direction = grain === 'recent' ? 'desc' : 'asc';
    return filtered.slice().sort((a, b) => byCreatedAt(a, b, direction));
  }, [cards, grain, cursor]);
  const perPage = Math.max(1, rows) * 2;
  const pageCount = Math.max(1, Math.ceil(visible.length / perPage));
  const safePage = Math.min(page, pageCount - 1);
  const pageCards = visible.slice(safePage * perPage, safePage * perPage + perPage);
  const canPrev = safePage > 0;
  const canNext = safePage < pageCount - 1;

  const goPage = useCallback(
    (dir: 'next' | 'prev') => {
      setPage((prev) => {
        const current = Math.min(prev, pageCount - 1);
        if (dir === 'next') return Math.min(pageCount - 1, current + 1);
        return Math.max(0, current - 1);
      });
    },
    [pageCount],
  );

  const swipe = useHorizontalPageSwipe({
    enabled: !viewing && visible.length > perPage,
    canPrev,
    canNext,
    onPage: goPage,
  });

  const viewIndex = viewing ? visible.findIndex((card) => card.id === viewing.id) : -1;
  const dropCard = useCallback((removedId: string) => {
    forgetFamilyLogAttachments(removedId);
    setCards((prev) => prev.filter((card) => card.id !== removedId));
    setViewing(null);
    setEditorOpen(false);
  }, []);
  const showNeighbor = useCallback(
    (dir: 'next' | 'prev') => {
      if (!viewing || editorOpen) return;
      const index = visible.findIndex((card) => card.id === viewing.id);
      const nextIndex = dir === 'next' ? index + 1 : index - 1;
      const next = visible[nextIndex];
      if (!next) return;
      setViewing(next);
      setPage(Math.floor(nextIndex / perPage));
    },
    [editorOpen, perPage, viewing, visible],
  );

  const createCard = useCallback(
    async (body: Record<string, unknown>) => {
      if (!currentGroupId) return false;
      setBusy(true);
      setError(null);
      try {
        const headers = await familyLogAuthHeaders();
        const res = await fetch('/api/v1/family-log/cards', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId: currentGroupId, ...body }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'save');
        const created = json.data as FamilyLogCard | undefined;
        if (!created?.id) return false;
        setCards((prev) => [created, ...prev.filter((card) => card.id !== created.id)]);
        setGrain('recent');
        setPage(0);
        setViewing(created);
        setEditorOpen(true);
        return true;
      } catch {
        setError(labels.saveFailed);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [currentGroupId, labels.saveFailed],
  );

  const handleCheckIn = async () => {
    if (!currentGroupId || busy || recording) return;
    setBusy(true);
    setError(null);
    try {
      const pos = await getPosition();
      const hm = localHm();
      setBusy(false);
      await createCard({
        kind: 'checkin',
        day_date: localDay(),
        time_hm: hm,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        fallback_title: familyLogCheckinFallback(lang, hm),
      });
    } catch {
      setBusy(false);
      setError(labels.locationFailed);
    }
  };

  const stopRoute = async () => {
    const points = pointsRef.current.slice();
    const startHm = startHmRef.current || localHm();
    const endHm = localHm();
    const first = points[0];
    const saved = await createCard({
      kind: 'route',
      day_date: startDayRef.current || localDay(),
      time_hm: startHm,
      end_hm: endHm,
      latitude: first?.latitude,
      longitude: first?.longitude,
      route_points: points,
      title: familyLogRouteTitle(lang, startHm, endHm),
    });
    if (!saved) return;
    if (watchRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    pointsRef.current = [];
    setRecording(false);
  };

  const handleRoute = async () => {
    if (!currentGroupId || busy) return;
    if (recording) {
      await stopRoute();
      return;
    }
    setError(null);
    try {
      const pos = await getPosition();
      const point: RoutePoint = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        recorded_at: new Date().toISOString(),
      };
      pointsRef.current = [point];
      startHmRef.current = localHm();
      startDayRef.current = localDay();
      watchRef.current = trackRoute(pointsRef);
      setRecording(true);
    } catch {
      setError(labels.locationFailed);
    }
  };

  const handleAddDaily = async () => {
    if (!currentGroupId || busy || recording) return;
    await createCard({
      kind: 'note',
      day_date: localDay(),
      title: labels.addDailyTitle,
    });
  };

  const pageIds = pageCards.map((card) => card.id).join('|');
  useEffect(() => {
    if (!currentGroupId || !pageIds) return;
    const ids = pageIds.split('|');
    const missing = ids.filter((id) => readFamilyLogAttachments(id)?.photos === undefined);
    if (missing.length === 0) return;
    let cancelled = false;
    void listAttachments({
      groupId: currentGroupId,
      entityType: 'family_log_card',
      entityIds: missing,
    })
      .then((rows) => {
        if (cancelled) return;
        const grouped = new Map<string, typeof rows>();
        for (const id of missing) grouped.set(id, []);
        for (const row of rows) {
          const list = grouped.get(row.entity_id);
          if (list) list.push(row);
        }
        for (const [id, photos] of grouped) {
          if (readFamilyLogAttachments(id)?.photos === undefined) writeFamilyLogAttachments(id, { photos });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [currentGroupId, pageIds]);

  const grainButton = (key: FamilyLogGrain, text: string) => (
    <button
      type="button"
      onClick={() => {
        setGrain(key);
        setPage(0);
        if (key === 'day') setCursor(localDay());
        if (key === 'month') setCursor(localDay().slice(0, 7));
        if (key === 'year') setCursor(localDay().slice(0, 4));
      }}
      className={`cursor-pointer border px-2 py-0.5 text-[11px] font-semibold ${
        illustrated
          ? grain === key
            ? 'rounded-full border-[#c4a574] bg-[#fff8ea] text-[#6b4e2e]'
            : 'rounded-full border-transparent bg-white/50 text-[#8a7355]'
          : isNeo
            ? grain === key
              ? 'rounded-sm border-2 border-[var(--neo-ink)] bg-[var(--neo-ink)] text-[var(--neo-paper)]'
              : 'rounded-sm border-2 border-[var(--neo-ink)] bg-white text-[var(--neo-ink)]'
            : grain === key
              ? 'rounded-full border-white/50 bg-white/20 text-white'
              : 'rounded-full border-white/25 bg-transparent text-white/75'
      }`}
    >
      {text}
    </button>
  );

  const pickerClass = (width: string) =>
    illustrated
      ? `${width} rounded-md border border-[#e4d3b0] bg-white/80 px-1 py-0.5 text-[11px] text-[#6b4e2e]`
      : isNeo
        ? `${width} rounded-sm border-2 border-[var(--neo-ink)] bg-white px-1 py-0.5 text-[11px] text-[var(--neo-ink)]`
        : `${width} rounded-md border border-white/30 bg-white/10 px-1 py-0.5 text-[11px] text-white`;
  const statusClass = illustrated
    ? 'm-0 text-center text-sm text-[#8a7355]'
    : isNeo
      ? 'm-0 text-center text-sm font-bold text-[var(--neo-ink)]'
      : 'm-0 text-center text-sm text-white/80';
  const actionClass = illustrated
    ? ''
    : isNeo
      ? 'min-w-0 flex-1 cursor-pointer rounded-sm border-2 border-[var(--neo-ink)] bg-white px-1.5 py-2 text-[11px] font-bold leading-tight text-[var(--neo-ink)] shadow-[2px_2px_0_0_var(--neo-ink)] disabled:cursor-not-allowed disabled:opacity-40'
      : 'min-w-0 flex-1 cursor-pointer rounded-full border border-white/35 bg-white/10 px-1.5 py-2 text-[11px] font-bold leading-tight text-white disabled:cursor-not-allowed disabled:opacity-40';
  const checkinClass = illustrated
    ? 'min-w-0 flex-1 cursor-pointer rounded-full border-0 bg-[#7d9a6a] px-1.5 py-2 text-[11px] font-bold leading-tight text-white disabled:cursor-not-allowed disabled:bg-slate-300'
    : actionClass;
  const routeClass = illustrated
    ? 'min-w-0 flex-1 cursor-pointer rounded-full border-0 bg-[#d08a4c] px-1.5 py-2 text-[11px] font-bold leading-tight text-white disabled:cursor-not-allowed disabled:bg-slate-300'
    : actionClass;
  const dailyClass = illustrated
    ? 'min-w-0 flex-1 cursor-pointer rounded-full border-0 bg-[#c4a574] px-1.5 py-2 text-[11px] font-bold leading-tight text-white disabled:cursor-not-allowed disabled:bg-slate-300'
    : actionClass;

  return (
    <section
      className={
        illustrated
          ? 'family-log-widget flex h-full min-h-0 flex-col overflow-hidden bg-[#fbf6ec]'
          : 'content-section family-log-widget'
      }
    >
      {illustrated ? (
        <div className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BG_SRC}
            alt={labels.widgetTitle}
            draggable={false}
            className="block h-auto w-full"
          />
        </div>
      ) : (
        <div className="section-header shrink-0">
          <h3 className="section-title m-0">{labels.widgetTitle}</h3>
        </div>
      )}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className={`flex shrink-0 items-center justify-between gap-2 pt-1 ${illustrated ? 'px-3' : ''}`}>
          <div className="flex min-w-0 gap-1">
            {grainButton('recent', labels.recent)}
            {grainButton('day', labels.day)}
            {grainButton('month', labels.month)}
            {grainButton('year', labels.year)}
          </div>
          {grain === 'day' ? (
            <input
              type="date"
              value={cursor.slice(0, 10)}
              onChange={(e) => {
                setCursor(e.target.value);
                setPage(0);
              }}
              className={pickerClass('w-[9.2rem]')}
            />
          ) : null}
          {grain === 'month' ? (
            <input
              type="month"
              value={cursor.slice(0, 7)}
              onChange={(e) => {
                setCursor(e.target.value);
                setPage(0);
              }}
              className={pickerClass('w-[8.2rem]')}
            />
          ) : null}
          {grain === 'year' ? (
            <input
              type="number"
              inputMode="numeric"
              min={2000}
              max={2100}
              value={cursor.slice(0, 4)}
              onChange={(e) => {
                setCursor(e.target.value.slice(0, 4));
                setPage(0);
              }}
              className={pickerClass('w-[5.2rem]')}
            />
          ) : null}
        </div>

        <div ref={areaRef} className={`relative min-h-0 flex-1 pt-2 ${illustrated ? 'px-3' : ''}`}>
          {!currentGroupId ? (
            <p className={statusClass}>{labels.selectGroup}</p>
          ) : loading && cards.length === 0 ? (
            <p className={statusClass}>{labels.loading}</p>
          ) : pageCards.length === 0 ? (
            <p className={statusClass}>{labels.empty}</p>
          ) : (
            <div className="grid h-full auto-rows-[88px] grid-cols-2 content-start gap-2" {...swipe}>
              {pageCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => {
                    setViewing(card);
                    setEditorOpen(false);
                  }}
                  className={
                    illustrated
                      ? 'flex h-full min-h-0 cursor-pointer flex-col overflow-hidden rounded-2xl border-2 border-[#ead7b2] bg-[#fffaf0]/95 text-left shadow-sm'
                      : isNeo
                        ? 'flex h-full min-h-0 cursor-pointer flex-col overflow-hidden rounded-sm border-2 border-[var(--neo-ink)] bg-white text-left shadow-[3px_3px_0_0_var(--neo-ink)]'
                        : 'glass-panel-soft flex h-full min-h-0 cursor-pointer flex-col overflow-hidden rounded-lg text-left text-foreground'
                  }
                >
                  <span className="flex min-h-0 flex-1 flex-col justify-center gap-0.5 px-2 py-1">
                    <span
                      className={
                        illustrated
                          ? 'truncate text-[9px] font-medium leading-none text-[#a48458]'
                          : isNeo
                            ? 'truncate text-[9px] font-bold leading-none text-[var(--neo-ink)]/70'
                            : 'truncate text-[9px] font-medium leading-none text-white/70'
                      }
                    >
                      {card.day_date}
                    </span>
                    <span
                      className={
                        illustrated
                          ? 'line-clamp-2 text-[12px] font-bold leading-tight text-[#5c4630]'
                          : isNeo
                            ? 'line-clamp-2 text-[12px] font-bold leading-tight text-[var(--neo-ink)]'
                            : 'line-clamp-2 text-[12px] font-bold leading-tight text-white'
                      }
                    >
                      {card.title}
                    </span>
                    {card.note ? (
                      <span
                        className={
                          illustrated
                            ? 'line-clamp-1 text-[10px] leading-tight text-[#8a7355]'
                            : isNeo
                              ? 'line-clamp-1 text-[10px] leading-tight text-[var(--neo-ink)]/80'
                              : 'line-clamp-1 text-[10px] leading-tight text-white/75'
                        }
                      >
                        {card.note}
                      </span>
                    ) : null}
                    {card.mood_tags.length > 0 || (card.amount != null && card.amount > 0) ? (
                      <span className="flex items-center gap-1 truncate text-[10px] leading-none">
                        {card.mood_tags.length > 0 ? <span>{card.mood_tags.slice(0, 3).join('')}</span> : null}
                        {card.amount != null && card.amount > 0 ? (
                          <span
                            className={
                              illustrated
                                ? 'font-semibold text-[#8a7355]'
                                : isNeo
                                  ? 'font-bold text-[var(--neo-ink)]'
                                  : 'font-semibold text-white/80'
                            }
                          >
                            {card.amount}
                            {card.currency ? ` ${card.currency}` : ''}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          )}

        </div>

        {recording ? (
          <p
            className={
              illustrated
                ? 'm-0 shrink-0 px-3 text-center text-[11px] font-semibold text-[#9a6230]'
                : isNeo
                  ? 'm-0 shrink-0 text-center text-[11px] font-bold text-[var(--neo-ink)]'
                  : 'm-0 shrink-0 text-center text-[11px] font-semibold text-white'
            }
          >
            {labels.recording}
          </p>
        ) : null}
        {error ? (
          <p className="m-0 shrink-0 px-3 text-center text-[11px] text-red-700">{error}</p>
        ) : null}
        {pageCount > 1 ? (
          <p
            className={
              illustrated
                ? 'm-0 shrink-0 text-center text-[10px] text-[#a48458]'
                : isNeo
                  ? 'm-0 shrink-0 text-center text-[10px] font-bold text-[var(--neo-ink)]'
                  : 'm-0 shrink-0 text-center text-[10px] text-white/70'
            }
          >
            {safePage + 1} / {pageCount}
          </p>
        ) : null}

        <div className={`flex shrink-0 gap-1.5 pt-1 ${illustrated ? 'px-3 pb-3' : ''}`}>
          <button
            type="button"
            onClick={() => void handleCheckIn()}
            disabled={!currentGroupId || busy || recording}
            className={checkinClass}
          >
            {labels.checkin}
          </button>
          <button
            type="button"
            onClick={() => void handleRoute()}
            disabled={!currentGroupId || busy}
            className={routeClass}
          >
            {recording ? labels.routeStop : labels.route}
          </button>
          <button
            type="button"
            onClick={() => void handleAddDaily()}
            disabled={!currentGroupId || busy || recording}
            className={dailyClass}
          >
            {labels.addDaily}
          </button>
        </div>
      </div>
      {viewing && !editorOpen && currentGroupId ? (
        <FamilyLogCardView
          key={viewing.id}
          card={viewing}
          groupId={currentGroupId}
          labels={labels}
          uiTheme={uiTheme}
          onClose={() => setViewing(null)}
          onEdit={() => setEditorOpen(true)}
          canPrev={viewIndex > 0}
          canNext={viewIndex >= 0 && viewIndex < visible.length - 1}
          onNeighbor={showNeighbor}
          onDeleted={() => dropCard(viewing.id)}
        />
      ) : null}
      {viewing && editorOpen && currentGroupId ? (
        <FamilyLogCardEditor
          key={viewing.id}
          card={viewing}
          groupId={currentGroupId}
          lang={lang}
          labels={labels}
          uiTheme={uiTheme}
          onClose={() => {
            setEditorOpen(false);
          }}
          onSaved={(updated) => {
            setCards((prev) => prev.map((card) => (card.id === updated.id ? updated : card)));
            setViewing(updated);
            setEditorOpen(false);
          }}
          onDeleted={() => dropCard(viewing.id)}
        />
      ) : null}
    </section>
  );
}
