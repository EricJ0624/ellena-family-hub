'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  formatRemainingSeconds,
  hitTestNormalized,
  tapToNormalized,
} from '@/lib/picture-find/game-logic';
import { resolveSpotDiffPair } from '@/lib/picture-find/spot-diff';
import {
  PICTURE_FIND_DURATION_MS,
  PICTURE_FIND_MAX_HINTS,
  type HiddenItem,
  type NormalizedRegion,
  type PictureFindMode,
  type PictureFindPuzzle,
  type PictureFindScene,
} from '@/lib/picture-find/types';
import {
  formatPictureFindText,
  type PictureFindTranslations,
} from '@/lib/translations/picture-find';

export type PictureFindGamePlayProps = {
  mode: PictureFindMode;
  scene: PictureFindScene;
  puzzle: PictureFindPuzzle;
  t: PictureFindTranslations;
  onComplete: (result: {
    foundCount: number;
    total: number;
    remainingMs: number;
    hintsUsed: number;
    timedOut: boolean;
  }) => void;
};

export function PictureFindGamePlay({ mode, scene, puzzle, t, onComplete }: PictureFindGamePlayProps) {
  const [foundIds, setFoundIds] = useState<Set<string>>(() => new Set());
  const [hintsUsed, setHintsUsed] = useState(0);
  const [remainingMs, setRemainingMs] = useState(PICTURE_FIND_DURATION_MS);
  const [hintFlashId, setHintFlashId] = useState<string | null>(null);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [variantUrl, setVariantUrl] = useState<string | null>(null);
  const [pairLoading, setPairLoading] = useState(mode === 'spot_diff');
  const [finished, setFinished] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);

  const targets = mode === 'hidden' ? puzzle.hiddenItems : puzzle.diffRegions;
  const total = puzzle.itemCount;

  useEffect(() => {
    setFoundIds(new Set());
    setHintsUsed(0);
    setRemainingMs(PICTURE_FIND_DURATION_MS);
    setHintFlashId(null);
    setWrongFlash(false);
    setFinished(false);
    completedRef.current = false;
  }, [puzzle.seed, mode, scene.id]);

  useEffect(() => {
    if (mode !== 'spot_diff') return;
    let cancelled = false;
    setPairLoading(true);
    void resolveSpotDiffPair(scene.imageUrl, scene.variantImageUrl, scene.diffMode, puzzle.diffRegions)
      .then((pair) => {
        if (!cancelled) setVariantUrl(pair.rightUrl);
      })
      .catch(() => {
        if (!cancelled) setVariantUrl(scene.imageUrl);
      })
      .finally(() => {
        if (!cancelled) setPairLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, scene, puzzle.diffRegions]);

  const finishGame = useCallback(
    (timedOut: boolean, foundOverride?: Set<string>) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setFinished(true);
      const foundSet = foundOverride ?? foundIds;
      onComplete({
        foundCount: foundSet.size,
        total,
        remainingMs,
        hintsUsed,
        timedOut,
      });
    },
    [foundIds, hintsUsed, onComplete, remainingMs, total],
  );

  useEffect(() => {
    if (finished) return;
    if (foundIds.size >= total) {
      finishGame(false);
    }
  }, [foundIds, total, finished, finishGame]);

  useEffect(() => {
    if (finished) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const next = PICTURE_FIND_DURATION_MS - elapsed;
      setRemainingMs(next);
      if (next <= 0) {
        window.clearInterval(timer);
        finishGame(true);
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [puzzle.seed, finished, finishGame]);

  const handleTap = (clientX: number, clientY: number, side?: 'left' | 'right') => {
    if (finished || !boardRef.current) return;
    if (mode === 'spot_diff' && side === 'left') return;

    const rect = boardRef.current.getBoundingClientRect();
    const { x, y } = tapToNormalized(clientX, clientY, rect);

    const hit = targets.find((target) => !foundIds.has(target.id) && hitTestNormalized(x, y, target));
    if (!hit) {
      setWrongFlash(true);
      window.setTimeout(() => setWrongFlash(false), 400);
      return;
    }

    setFoundIds((prev) => {
      const next = new Set(prev);
      next.add(hit.id);
      if (next.size >= total) {
        window.setTimeout(() => finishGame(false, next), 0);
      }
      return next;
    });
  };

  const useHint = () => {
    if (finished || hintsUsed >= PICTURE_FIND_MAX_HINTS) return;
    const unfound = targets.filter((target) => !foundIds.has(target.id));
    if (unfound.length === 0) return;
    const pick = unfound[Math.floor(Math.random() * unfound.length)];
    setHintsUsed((n) => n + 1);
    setHintFlashId(pick.id);
    window.setTimeout(() => setHintFlashId(null), 1200);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
        <span>
          {t.timer_label}: {formatRemainingSeconds(remainingMs)}s
        </span>
        <span>
          {t.found_label}: {foundIds.size}/{total}
        </span>
        <span>
          {t.hints_label}: {PICTURE_FIND_MAX_HINTS - hintsUsed}
        </span>
        <button
          type="button"
          onClick={useHint}
          disabled={finished || hintsUsed >= PICTURE_FIND_MAX_HINTS}
          className="rounded-lg bg-amber-500 px-3 py-1 text-white disabled:opacity-40"
        >
          {t.hint_button}
        </button>
      </div>

      {wrongFlash && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{t.wrong_tap}</p>
      )}

      {mode === 'hidden' ? (
        <div
          ref={boardRef}
          className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
          style={{ aspectRatio: '4 / 3' }}
          onClick={(e) => handleTap(e.clientX, e.clientY)}
          role="button"
          tabIndex={0}
          aria-label={t.mode_hidden}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={scene.imageUrl} alt={scene.title} className="h-full w-full object-cover" draggable={false} />
          {puzzle.hiddenItems.map((item) => (
            <HiddenItemMarker
              key={item.id}
              item={item}
              found={foundIds.has(item.id)}
              flash={hintFlashId === item.id}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <DiffPanel
            label={t.left_image}
            imageUrl={scene.imageUrl}
            title={scene.title}
            side="left"
            readOnly
          />
          <DiffPanel
            label={t.right_image}
            imageUrl={variantUrl ?? scene.imageUrl}
            title={scene.title}
            side="right"
            loading={pairLoading}
            onTap={handleTap}
            boardRef={boardRef}
            regions={puzzle.diffRegions}
            foundIds={foundIds}
            hintFlashId={hintFlashId}
          />
        </div>
      )}
    </div>
  );
}

function HiddenItemMarker({
  item,
  found,
  flash,
}: {
  item: HiddenItem;
  found: boolean;
  flash: boolean;
}) {
  if (found) return null;
  return (
    <span
      className={`absolute -translate-x-1/2 -translate-y-1/2 select-none text-[clamp(16px,4vw,28px)] transition-transform ${
        flash ? 'scale-125 animate-pulse rounded-full ring-4 ring-amber-400 ring-offset-2' : ''
      }`}
      style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}
      aria-hidden="true"
    >
      {item.emoji}
    </span>
  );
}

function DiffPanel({
  label,
  imageUrl,
  title,
  side,
  onTap,
  boardRef,
  loading,
  readOnly,
  regions,
  foundIds,
  hintFlashId,
}: {
  label: string;
  imageUrl: string;
  title: string;
  side: 'left' | 'right';
  onTap?: (x: number, y: number, side: 'left' | 'right') => void;
  boardRef?: React.RefObject<HTMLDivElement | null>;
  loading?: boolean;
  readOnly?: boolean;
  regions?: NormalizedRegion[];
  foundIds?: Set<string>;
  hintFlashId?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div
        ref={side === 'right' ? boardRef : undefined}
        className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${
          readOnly ? 'opacity-95' : ''
        }`}
        style={{ aspectRatio: '4 / 3' }}
        onClick={readOnly || !onTap ? undefined : (e) => onTap(e.clientX, e.clientY, side)}
        role={readOnly ? 'img' : 'button'}
        tabIndex={readOnly ? -1 : 0}
        aria-label={label}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">…</div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={title} className="h-full w-full object-cover" draggable={false} />
            {regions?.map((region) => {
              if (!foundIds?.has(region.id) && hintFlashId === region.id) {
                return (
                  <span
                    key={region.id}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full ring-4 ring-amber-400"
                    style={{
                      left: `${region.x * 100}%`,
                      top: `${region.y * 100}%`,
                      width: `${region.r * 200}%`,
                      height: `${region.r * 200}%`,
                    }}
                  />
                );
              }
              return null;
            })}
          </>
        )}
      </div>
    </div>
  );
}

export function PictureFindResultPanel({
  t,
  foundCount,
  total,
  remainingMs,
  hintsUsed,
  timedOut,
  onPlayAgain,
  onPickAnother,
  onChangeMode,
  onShare,
  shareLoading,
  shareMessage,
  shareDisabled,
  leaderboard,
  leaderboardLoading,
  myUserId,
}: {
  t: PictureFindTranslations;
  foundCount: number;
  total: number;
  remainingMs: number;
  hintsUsed: number;
  timedOut: boolean;
  onPlayAgain: () => void;
  onPickAnother: () => void;
  onChangeMode: () => void;
  onShare?: () => void;
  shareLoading?: boolean;
  shareMessage?: string | null;
  shareDisabled?: boolean;
  leaderboard?: Array<{
    rank: number;
    userId: string;
    nickname?: string | null;
    foundCount: number;
    totalCount: number;
    elapsedMs: number;
    hintsUsed: number;
    completed: boolean;
  }>;
  leaderboardLoading?: boolean;
  myUserId?: string;
}) {
  const summary = useMemo(
    () => ({
      found: formatPictureFindText(t.result_found, {
        found: String(foundCount),
        total: String(total),
      }),
      time: formatPictureFindText(t.result_time, {
        seconds: formatRemainingSeconds(remainingMs),
      }),
      hints: formatPictureFindText(t.result_hints, { used: String(hintsUsed) }),
    }),
    [t, foundCount, total, remainingMs, hintsUsed],
  );

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <h4 className="text-lg font-bold text-slate-800">{t.result_title}</h4>
      {timedOut && foundCount < total && (
        <p className="text-sm font-medium text-amber-700">{t.time_up}</p>
      )}
      <p className="text-base text-slate-700">{summary.found}</p>
      <p className="text-sm text-slate-500">{summary.time}</p>
      <p className="text-sm text-slate-500">{summary.hints}</p>

      {onShare && (
        <button
          type="button"
          disabled={shareLoading || shareDisabled}
          onClick={onShare}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {shareLoading ? t.loading : t.family_share}
        </button>
      )}
      {shareMessage && <p className="text-sm text-indigo-700">{shareMessage}</p>}

      {(leaderboardLoading || (leaderboard && leaderboard.length >= 0)) && (
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 p-3 text-left">
          <p className="mb-2 text-sm font-bold text-slate-800">{t.leaderboard_title}</p>
          {leaderboardLoading ? (
            <p className="text-xs text-slate-500">{t.leaderboard_loading}</p>
          ) : !leaderboard || leaderboard.length === 0 ? (
            <p className="text-xs text-slate-500">{t.leaderboard_empty}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {leaderboard.slice(0, 10).map((entry) => (
                <li
                  key={entry.userId}
                  className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-xs ${
                    entry.userId === myUserId ? 'bg-indigo-100 text-indigo-900' : 'bg-white text-slate-700'
                  }`}
                >
                  <span className="font-semibold">
                    {formatPictureFindText(t.leaderboard_rank, { rank: String(entry.rank) })}{' '}
                    {entry.nickname || (entry.userId === myUserId ? t.leaderboard_me : entry.userId.slice(0, 6))}
                  </span>
                  <span>
                    {entry.foundCount}/{entry.totalCount} · {Math.round(entry.elapsedMs / 1000)}s · hint {entry.hintsUsed}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <button type="button" onClick={onPlayAgain} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
          {t.play_again}
        </button>
        <button type="button" onClick={onPickAnother} className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
          {t.pick_another}
        </button>
        <button type="button" onClick={onChangeMode} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600">
          {t.change_mode}
        </button>
      </div>
    </div>
  );
}
