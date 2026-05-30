'use client';

import React, { useMemo, useState } from 'react';
import type { FamilyTaskMemberOption } from '@/app/features/family-tasks/types';
import {
  LADDER_MAX_LANES,
  LADDER_MIN_LANES,
  LADDER_ROW_COUNT,
  fillRandomRungs,
  traceLadderPath,
  type LadderPhase,
  type LadderRung,
} from '../types';

type LadderTranslations = {
  ladder_participants: string;
  ladder_destinations: string;
  ladder_participant_ph: string;
  ladder_destination_ph: string;
  ladder_add_pair: string;
  ladder_remove_pair: string;
  ladder_min_players: string;
  ladder_to_draw: string;
  ladder_draw_hint: string;
  ladder_drawn_by: string;
  ladder_you: string;
  ladder_start: string;
  ladder_reset: string;
  ladder_result_title: string;
  ladder_path_result: string;
};

interface LadderGameTabProps {
  userId: string;
  members: FamilyTaskMemberOption[];
  translations: LadderTranslations;
  formatText: (template: string, vars: Record<string, string>) => string;
}

export function LadderGameTab({
  userId,
  members,
  translations: t,
  formatText,
}: LadderGameTabProps) {
  const [phase, setPhase] = useState<LadderPhase>('setup');
  const [participants, setParticipants] = useState<string[]>(['', '']);
  const [destinations, setDestinations] = useState<string[]>(['', '']);
  const [drawnRungs, setDrawnRungs] = useState<LadderRung[]>([]);
  const [finalRungs, setFinalRungs] = useState<LadderRung[]>([]);
  const [activeDrawerId, setActiveDrawerId] = useState<string>(userId);

  const laneCount = participants.length;

  const drawerOptions = useMemo(() => {
    if (members.length > 0) return members;
    return [{ userId, nickname: t.ladder_you }];
  }, [members, userId, t.ladder_you]);

  const results = useMemo(() => {
    if (phase !== 'result') return [];
    return participants.map((from, startLane) => {
      const endLane = traceLadderPath(startLane, finalRungs, LADDER_ROW_COUNT);
      const to = destinations[endLane] ?? '';
      return { from, to };
    });
  }, [phase, participants, destinations, finalRungs]);

  const userHasDrawn = drawnRungs.some((r) => r.drawnBy === activeDrawerId);

  const updatePair = (index: number, field: 'participant' | 'destination', value: string) => {
    if (field === 'participant') {
      setParticipants((prev) => prev.map((p, i) => (i === index ? value : p)));
    } else {
      setDestinations((prev) => prev.map((d, i) => (i === index ? value : d)));
    }
  };

  const addPair = () => {
    if (laneCount >= LADDER_MAX_LANES) return;
    setParticipants((prev) => [...prev, '']);
    setDestinations((prev) => [...prev, '']);
  };

  const removePair = () => {
    if (laneCount <= LADDER_MIN_LANES) return;
    setParticipants((prev) => prev.slice(0, -1));
    setDestinations((prev) => prev.slice(0, -1));
  };

  const canStartDraw = () => {
    const filled = participants.every((p) => p.trim()) && destinations.every((d) => d.trim());
    return filled && laneCount >= LADDER_MIN_LANES;
  };

  const startDrawPhase = () => {
    if (!canStartDraw()) return;
    setDrawnRungs([]);
    setFinalRungs([]);
    setActiveDrawerId(userId);
    setPhase('draw');
  };

  const handleRungClick = (leftLane: number, row: number) => {
    if (phase !== 'draw' || userHasDrawn) return;
    const exists = drawnRungs.some((r) => r.leftLane === leftLane && r.row === row);
    if (exists) return;
    setDrawnRungs((prev) => [...prev, { leftLane, row, drawnBy: activeDrawerId }]);
  };

  const finishLadder = () => {
    const filled = fillRandomRungs(laneCount, drawnRungs, LADDER_ROW_COUNT);
    setFinalRungs(filled);
    setPhase('result');
  };

  const reset = () => {
    setPhase('setup');
    setDrawnRungs([]);
    setFinalRungs([]);
  };

  const svgWidth = 100;
  const svgHeight = 100;
  const laneX = (lane: number) => (lane / Math.max(1, laneCount - 1)) * svgWidth;
  const rowY = (row: number) => 12 + (row / Math.max(1, LADDER_ROW_COUNT - 1)) * 68;

  if (phase === 'setup') {
    return (
      <div className="grid" style={{ gap: '2.5cqmin' }}>
        <div className="grid sm:grid-cols-2" style={{ gap: '2.5cqmin' }}>
          <div>
            <div className="font-semibold text-[#334155]" style={{ fontSize: '4.5cqmin', marginBottom: '1.5cqmin' }}>
              {t.ladder_participants}
            </div>
            <div className="grid" style={{ gap: '1.5cqmin' }}>
              {participants.map((value, index) => (
                <input
                  key={`p-${index}`}
                  value={value}
                  onChange={(e) => updatePair(index, 'participant', e.target.value)}
                  placeholder={t.ladder_participant_ph}
                  className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-[#1e293b] outline-none focus:border-indigo-400"
                  style={{ fontSize: '4.5cqmin' }}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="font-semibold text-[#334155]" style={{ fontSize: '4.5cqmin', marginBottom: '1.5cqmin' }}>
              {t.ladder_destinations}
            </div>
            <div className="grid" style={{ gap: '1.5cqmin' }}>
              {destinations.map((value, index) => (
                <input
                  key={`d-${index}`}
                  value={value}
                  onChange={(e) => updatePair(index, 'destination', e.target.value)}
                  placeholder={t.ladder_destination_ph}
                  className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-[#1e293b] outline-none focus:border-indigo-400"
                  style={{ fontSize: '4.5cqmin' }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap" style={{ gap: '1.5cqmin' }}>
          <button
            type="button"
            onClick={addPair}
            disabled={laneCount >= LADDER_MAX_LANES}
            className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white disabled:opacity-50"
            style={{ fontSize: '4cqmin' }}
          >
            {t.ladder_add_pair}
          </button>
          <button
            type="button"
            onClick={removePair}
            disabled={laneCount <= LADDER_MIN_LANES}
            className="rounded-lg bg-slate-200 px-3 py-2 font-semibold text-slate-700 disabled:opacity-50"
            style={{ fontSize: '4cqmin' }}
          >
            {t.ladder_remove_pair}
          </button>
          <button
            type="button"
            onClick={startDrawPhase}
            disabled={!canStartDraw()}
            className="rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white disabled:opacity-50"
            style={{ fontSize: '4cqmin' }}
          >
            {t.ladder_to_draw}
          </button>
        </div>
        {!canStartDraw() && (
          <p className="text-[#64748b]" style={{ fontSize: '4cqmin' }}>
            {t.ladder_min_players}
          </p>
        )}
      </div>
    );
  }

  const displayRungs = phase === 'result' ? finalRungs : drawnRungs;

  return (
    <div className="grid" style={{ gap: '2cqmin' }}>
      <div className="flex flex-wrap items-center justify-between" style={{ gap: '1.5cqmin' }}>
        {phase === 'draw' ? (
          <>
            <p className="text-[#475569]" style={{ fontSize: '4cqmin' }}>
              {t.ladder_draw_hint}
            </p>
            <div className="flex flex-wrap items-center" style={{ gap: '1cqmin' }}>
              <select
                value={activeDrawerId}
                onChange={(e) => setActiveDrawerId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white/90 px-2 py-1 text-[#1e293b]"
                style={{ fontSize: '4cqmin' }}
              >
                {drawerOptions.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.userId === userId ? t.ladder_you : m.nickname}
                  </option>
                ))}
              </select>
              {userHasDrawn && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800" style={{ fontSize: '3.5cqmin' }}>
                  {formatText(t.ladder_drawn_by, {
                    name: drawerOptions.find((m) => m.userId === activeDrawerId)?.nickname ?? t.ladder_you,
                  })}
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="font-semibold text-[#1e293b]" style={{ fontSize: '4.5cqmin' }}>
            {t.ladder_result_title}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-slate-200 px-3 py-1.5 font-semibold text-slate-700"
          style={{ fontSize: '4cqmin' }}
        >
          {t.ladder_reset}
        </button>
      </div>

      <div className="glass-panel-soft overflow-x-auto rounded-xl" style={{ padding: '2cqmin' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="mx-auto w-full max-w-full"
          style={{ minHeight: '40cqmin' }}
          role="img"
          aria-label="ladder"
        >
          {participants.map((label, lane) => (
            <text
              key={`top-${lane}`}
              x={laneX(lane)}
              y={6}
              textAnchor="middle"
              className="fill-slate-700"
              style={{ fontSize: 4 }}
            >
              {label.slice(0, 6)}
            </text>
          ))}
          {destinations.map((label, lane) => (
            <text
              key={`bottom-${lane}`}
              x={laneX(lane)}
              y={98}
              textAnchor="middle"
              className="fill-slate-700"
              style={{ fontSize: 4 }}
            >
              {label.slice(0, 6)}
            </text>
          ))}
          {Array.from({ length: laneCount }).map((_, lane) => (
            <line
              key={`v-${lane}`}
              x1={laneX(lane)}
              y1={10}
              x2={laneX(lane)}
              y2={90}
              stroke="#64748b"
              strokeWidth={0.6}
            />
          ))}
          {displayRungs.map((rung, idx) => {
            const x1 = laneX(rung.leftLane);
            const x2 = laneX(rung.leftLane + 1);
            const y = rowY(rung.row);
            return (
              <line
                key={`h-${idx}`}
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke={rung.drawnBy ? '#6366f1' : '#94a3b8'}
                strokeWidth={1.2}
              />
            );
          })}
          {phase === 'draw' &&
            Array.from({ length: LADDER_ROW_COUNT }).map((_, row) =>
              Array.from({ length: laneCount - 1 }).map((_, leftLane) => {
                const taken = drawnRungs.some((r) => r.leftLane === leftLane && r.row === row);
                if (taken) return null;
                const cx = (laneX(leftLane) + laneX(leftLane + 1)) / 2;
                const cy = rowY(row);
                return (
                  <circle
                    key={`hit-${leftLane}-${row}`}
                    cx={cx}
                    cy={cy}
                    r={2.2}
                    className={userHasDrawn ? 'fill-transparent' : 'cursor-pointer fill-indigo-400/30 hover:fill-indigo-500/50'}
                    onClick={() => handleRungClick(leftLane, row)}
                  />
                );
              }),
            )}
        </svg>
      </div>

      {phase === 'draw' && (
        <button
          type="button"
          onClick={finishLadder}
          className="rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white"
          style={{ fontSize: '4.5cqmin' }}
        >
          {t.ladder_start}
        </button>
      )}

      {phase === 'result' && (
        <ul className="m-0 list-none p-0" style={{ gap: '1cqmin' }}>
          {results.map((r, i) => (
            <li
              key={i}
              className="glass-panel-soft rounded-lg text-[#1e293b]"
              style={{ padding: '2cqmin 2.5cqmin', fontSize: '4.5cqmin', marginBottom: '1cqmin' }}
            >
              {formatText(t.ladder_path_result, { from: r.from, to: r.to })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
