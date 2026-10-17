'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LangCode } from '@/lib/language-fonts';
import { useHorizontalPageSwipe } from '@/lib/hooks/useHorizontalPageSwipe';
import { listAttachments } from '@/lib/feature-attachments-client';
import { familyLogAuthHeaders } from '../client-auth';
import { FamilyLogCardEditor } from './FamilyLogCardEditor';
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
};

function localDay(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function localHm(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

export function FamilyLogSection({ currentGroupId, lang }: Props) {
  const labels = getFamilyLogLabels(lang);
  const [cards, setCards] = useState<FamilyLogCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grain, setGrain] = useState<FamilyLogGrain>('recent');
  const [cursor, setCursor] = useState(localDay());
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(2);
  const [recording, setRecording] = useState(false);
  const [editing, setEditing] = useState<FamilyLogCard | null>(null);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [coverEpoch, setCoverEpoch] = useState(0);

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
      setCards((prev) => {
        const prevSig = prev.map((c) => `${c.id}:${c.title}:${c.updated_at}`).join('|');
        const nextSig = next.map((c) => `${c.id}:${c.title}:${c.updated_at}`).join('|');
        return prevSig === nextSig ? prev : next;
      });
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

  const visible = useMemo(
    () => cards.filter((card) => matchesGrain(card, grain, cursor)),
    [cards, grain, cursor],
  );
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
    enabled: !editing && visible.length > perPage,
    canPrev,
    canNext,
    onPage: goPage,
  });

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
        setEditing(created);
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
    if (watchRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
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
    if (!saved) {
      setRecording(true);
      return;
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
      watchRef.current = navigator.geolocation.watchPosition(
        (next) => {
          pointsRef.current.push({
            latitude: next.coords.latitude,
            longitude: next.coords.longitude,
            recorded_at: new Date().toISOString(),
          });
        },
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 5000 },
      );
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
    if (!currentGroupId || pageCards.length === 0) return;
    let cancelled = false;
    void listAttachments({
      groupId: currentGroupId,
      entityType: 'family_log_card',
      entityIds: pageCards.map((card) => card.id),
    })
      .then((rows) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const row of rows) {
          if (!next[row.entity_id]) next[row.entity_id] = row.thumbnail_url || row.image_url;
        }
        setCovers((prev) => {
          const prevSig = Object.entries(prev).sort().join('|');
          const nextSig = Object.entries(next).sort().join('|');
          return prevSig === nextSig ? prev : next;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [currentGroupId, pageIds, coverEpoch]);

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
      className={`cursor-pointer rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        grain === key
          ? 'border-[#c4a574] bg-[#fff8ea] text-[#6b4e2e]'
          : 'border-transparent bg-white/50 text-[#8a7355]'
      }`}
    >
      {text}
    </button>
  );

  return (
    <section className="family-log-widget flex h-full min-h-0 flex-col overflow-hidden bg-[#fbf6ec]">
      <div className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BG_SRC}
          alt={labels.widgetTitle}
          draggable={false}
          className="block h-auto w-full"
        />
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-1">
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
              className="w-[9.2rem] rounded-md border border-[#e4d3b0] bg-white/80 px-1 py-0.5 text-[11px] text-[#6b4e2e]"
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
              className="w-[8.2rem] rounded-md border border-[#e4d3b0] bg-white/80 px-1 py-0.5 text-[11px] text-[#6b4e2e]"
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
              className="w-[5.2rem] rounded-md border border-[#e4d3b0] bg-white/80 px-1 py-0.5 text-[11px] text-[#6b4e2e]"
            />
          ) : null}
        </div>

        <div ref={areaRef} className="relative min-h-0 flex-1 px-3 pt-2">
          {!currentGroupId ? (
            <p className="m-0 text-center text-sm text-[#8a7355]">{labels.selectGroup}</p>
          ) : loading && cards.length === 0 ? (
            <p className="m-0 text-center text-sm text-[#8a7355]">{labels.loading}</p>
          ) : pageCards.length === 0 ? (
            <p className="m-0 text-center text-sm text-[#8a7355]">{labels.empty}</p>
          ) : (
            <div className="grid h-full auto-rows-[88px] grid-cols-2 content-start gap-2" {...swipe}>
              {pageCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setEditing(card)}
                  className="flex h-full min-h-0 cursor-pointer flex-col overflow-hidden rounded-2xl border-2 border-[#ead7b2] bg-[#fffaf0]/95 text-left shadow-sm"
                >
                  {covers[card.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={covers[card.id]} alt="" className="h-8 w-full object-cover" />
                  ) : null}
                  <span className="shrink-0 px-2 pt-1 text-[10px] font-medium text-[#a48458]">
                    {card.day_date}
                  </span>
                  <span className="mt-0.5 line-clamp-2 px-2 pb-1 text-[13px] font-bold leading-snug text-[#5c4630]">
                    {card.title}
                  </span>
                </button>
              ))}
            </div>
          )}

        </div>

        {recording ? (
          <p className="m-0 shrink-0 px-3 text-center text-[11px] font-semibold text-[#9a6230]">
            {labels.recording}
          </p>
        ) : null}
        {error ? (
          <p className="m-0 shrink-0 px-3 text-center text-[11px] text-red-700">{error}</p>
        ) : null}
        {pageCount > 1 ? (
          <p className="m-0 shrink-0 text-center text-[10px] text-[#a48458]">
            {safePage + 1} / {pageCount}
          </p>
        ) : null}

        <div className="flex shrink-0 gap-1.5 px-3 pb-3 pt-1">
          <button
            type="button"
            onClick={() => void handleCheckIn()}
            disabled={!currentGroupId || busy || recording}
            className="min-w-0 flex-1 cursor-pointer rounded-full border-0 bg-[#7d9a6a] px-1.5 py-2 text-[11px] font-bold leading-tight text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {labels.checkin}
          </button>
          <button
            type="button"
            onClick={() => void handleRoute()}
            disabled={!currentGroupId || busy}
            className="min-w-0 flex-1 cursor-pointer rounded-full border-0 bg-[#d08a4c] px-1.5 py-2 text-[11px] font-bold leading-tight text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {recording ? labels.routeStop : labels.route}
          </button>
          <button
            type="button"
            onClick={() => void handleAddDaily()}
            disabled={!currentGroupId || busy || recording}
            className="min-w-0 flex-1 cursor-pointer rounded-full border-0 bg-[#c4a574] px-1.5 py-2 text-[11px] font-bold leading-tight text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {labels.addDaily}
          </button>
        </div>
      </div>
      {editing && currentGroupId ? (
        <FamilyLogCardEditor
          card={editing}
          groupId={currentGroupId}
          lang={lang}
          labels={labels}
          onClose={() => {
            setEditing(null);
            setCoverEpoch((n) => n + 1);
          }}
          onSaved={(updated) => {
            setCards((prev) => prev.map((card) => (card.id === updated.id ? updated : card)));
            setEditing(null);
            setCoverEpoch((n) => n + 1);
          }}
        />
      ) : null}
    </section>
  );
}
