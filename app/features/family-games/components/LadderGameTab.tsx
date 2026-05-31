'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { FamilyTaskMemberOption } from '@/app/features/family-tasks/types';
import {
  LADDER_MAX_LANES,
  LADDER_MIN_LANES,
  LADDER_ROW_COUNT,
  generateDenseLadderRungs,
  getLadderPathColor,
  pointsToSvgPath,
  traceLadderPath,
  traceLadderPathPoints,
  type LadderLaunchConfig,
  type LadderPhase,
  type LadderRung,
} from '../types';
import { getMemberNickname, MemberSelect } from './MemberSelect';

type LadderTranslations = {
  ladder_participants: string;
  ladder_destinations: string;
  ladder_participant_ph: string;
  ladder_destination_ph: string;
  select_member: string;
  no_members: string;
  ladder_add_pair: string;
  ladder_remove_pair: string;
  ladder_min_players: string;
  ladder_draw_hint: string;
  ladder_start_hint: string;
  ladder_drawn_by: string;
  ladder_draw_progress: string;
  ladder_you: string;
  ladder_start: string;
  ladder_reset: string;
  ladder_result_title: string;
  ladder_path_result: string;
};

type LadderGameTabBaseProps = {
  userId: string;
  members: FamilyTaskMemberOption[];
  translations: LadderTranslations;
  formatText: (template: string, vars: Record<string, string>) => string;
};

type LadderGameTabSetupProps = LadderGameTabBaseProps & {
  mode: 'setup';
  launchLabel: string;
  onLaunch: (config: LadderLaunchConfig) => void;
  launchConfig?: never;
};

type LadderGameTabPlayProps = LadderGameTabBaseProps & {
  mode: 'play';
  launchConfig: LadderLaunchConfig;
  launchLabel?: never;
  onLaunch?: never;
};

export type LadderGameTabProps = LadderGameTabSetupProps | LadderGameTabPlayProps;

const SVG_TOP = 10;
const SVG_BOTTOM = 90;

export function LadderGameTab(props: LadderGameTabProps) {
  const { userId, members, translations: t, formatText, mode } = props;

  const isSetup = mode === 'setup';
  const playConfig = mode === 'play' ? props.launchConfig : null;

  const [participantIds, setParticipantIds] = useState<string[]>(
    playConfig?.participantIds ?? ['', ''],
  );
  const [destinations, setDestinations] = useState<string[]>(
    playConfig?.destinations ?? ['', ''],
  );
  const [phase, setPhase] = useState<LadderPhase>(isSetup ? 'setup' : 'draw');
  const [userRungs, setUserRungs] = useState<LadderRung[]>([]);
  const [finalRungs, setFinalRungs] = useState<LadderRung[]>([]);
  const [displayRungs, setDisplayRungs] = useState<LadderRung[]>([]);
  const [activeDrawerId, setActiveDrawerId] = useState<string>(userId);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showPaths, setShowPaths] = useState(false);

  const laneCount = participantIds.length;
  const configKey = `${participantIds.join('|')}::${destinations.join('|')}`;

  const setupReady = useMemo(() => {
    const idsOk =
      participantIds.every((id) => id.trim()) &&
      new Set(participantIds).size === participantIds.length;
    const destinationsOk = destinations.every((d) => d.trim());
    return idsOk && destinationsOk && laneCount >= LADDER_MIN_LANES && members.length > 0;
  }, [participantIds, destinations, laneCount, members.length]);

  const participantsReady = useMemo(() => {
    const idsOk =
      participantIds.every((id) => id.trim()) &&
      new Set(participantIds).size === participantIds.length;
    return idsOk && laneCount >= LADDER_MIN_LANES && members.length > 0;
  }, [participantIds, laneCount, members.length]);

  const participantMembers = useMemo(
    () =>
      participantIds
        .map((id) => members.find((m) => m.userId === id))
        .filter((m): m is FamilyTaskMemberOption => Boolean(m)),
    [participantIds, members],
  );

  const participantLabels = useMemo(
    () =>
      participantIds.map((id) =>
        getMemberNickname(members, id, userId, t.ladder_you),
      ),
    [participantIds, members, userId, t.ladder_you],
  );

  const drawnParticipantIds = useMemo(
    () => new Set(userRungs.map((r) => r.drawnBy).filter(Boolean)),
    [userRungs],
  );

  const userHasDrawn = drawnParticipantIds.has(activeDrawerId);

  const results = useMemo(() => {
    if (phase !== 'result' || finalRungs.length === 0) return [];
    return participantIds.map((fromId, startLane) => {
      const endLane = traceLadderPath(startLane, finalRungs, LADDER_ROW_COUNT);
      const from = getMemberNickname(members, fromId, userId, t.ladder_you);
      const to = destinations[endLane] ?? '';
      return { from, to, startLane, endLane };
    });
  }, [phase, participantIds, destinations, finalRungs, members, userId, t.ladder_you]);

  const svgWidth = 100;
  const svgHeight = 100;
  const laneX = (lane: number) => (lane / Math.max(1, laneCount - 1)) * svgWidth;
  const rowY = (row: number) => 12 + (row / Math.max(1, LADDER_ROW_COUNT - 1)) * 68;

  useEffect(() => {
    if (isSetup) return;
    setUserRungs([]);
    setFinalRungs([]);
    setDisplayRungs([]);
    setShowPaths(false);
    setIsRevealing(false);
    setPhase('draw');
    setActiveDrawerId(userId);
  }, [configKey, isSetup, userId]);

  useEffect(() => {
    if (isSetup || !setupReady || phase === 'result') return;
    setActiveDrawerId((prev) => {
      if (participantIds.includes(prev) && !drawnParticipantIds.has(prev)) return prev;
      if (participantIds.includes(userId) && !drawnParticipantIds.has(userId)) return userId;
      const nextUndrawn = participantIds.find((id) => !drawnParticipantIds.has(id));
      return nextUndrawn ?? participantIds[0] ?? userId;
    });
  }, [isSetup, setupReady, participantIds, userId, userRungs, phase, drawnParticipantIds]);

  const updateParticipant = (index: number, value: string) => {
    setParticipantIds((prev) => prev.map((p, i) => (i === index ? value : p)));
  };

  const updateDestination = (index: number, value: string) => {
    setDestinations((prev) => prev.map((d, i) => (i === index ? value : d)));
  };

  const addPair = () => {
    if (laneCount >= LADDER_MAX_LANES) return;
    setParticipantIds((prev) => [...prev, '']);
    setDestinations((prev) => [...prev, '']);
  };

  const removePair = () => {
    if (laneCount <= LADDER_MIN_LANES) return;
    setParticipantIds((prev) => prev.slice(0, -1));
    setDestinations((prev) => prev.slice(0, -1));
  };

  const launchLadderGame = () => {
    if (mode !== 'setup' || !participantsReady) return;
    const resolvedDestinations = destinations.map((d, index) =>
      d.trim() ? d.trim() : `${t.ladder_destination_ph} ${index + 1}`,
    );
    props.onLaunch({
      participantIds: [...participantIds],
      destinations: resolvedDestinations,
    });
  };

  const handleRungClick = (leftLane: number, row: number) => {
    if (isSetup || !setupReady || phase === 'result' || isRevealing || userHasDrawn || !activeDrawerId) return;
    const exists = userRungs.some((r) => r.leftLane === leftLane && r.row === row);
    if (exists) return;
    setUserRungs((prev) => [...prev, { leftLane, row, drawnBy: activeDrawerId }]);
  };

  const startLadder = () => {
    if (isSetup || !setupReady || isRevealing) return;
    const generated = generateDenseLadderRungs(laneCount, userRungs, LADDER_ROW_COUNT);
    const autoRungs = generated.filter((r) => !r.drawnBy);

    setFinalRungs(generated);
    setPhase('result');
    setIsRevealing(true);
    setShowPaths(false);
    setDisplayRungs([...userRungs]);

    let index = 0;
    const timer = window.setInterval(() => {
      if (index >= autoRungs.length) {
        window.clearInterval(timer);
        setIsRevealing(false);
        window.setTimeout(() => setShowPaths(true), 200);
        return;
      }
      const next = autoRungs[index];
      setDisplayRungs((prev) => [...prev, next]);
      index += 1;
    }, 35);
  };

  const resetPlay = () => {
    setUserRungs([]);
    setFinalRungs([]);
    setDisplayRungs([]);
    setShowPaths(false);
    setIsRevealing(false);
    setPhase('draw');
    setActiveDrawerId(userId);
  };

  const renderLadderSvg = (
    rungs: LadderRung[],
    options: { interactive: boolean; showResultPaths: boolean },
  ) => (
    <div className="glass-panel-soft overflow-x-auto rounded-xl" style={{ padding: '2cqmin' }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="mx-auto w-full max-w-full"
        style={{ minHeight: '45cqmin' }}
        role="img"
        aria-label="ladder"
      >
        {participantLabels.map((label, lane) => (
          <text
            key={`top-${lane}`}
            x={laneX(lane)}
            y={6}
            textAnchor="middle"
            className="fill-slate-800 font-semibold"
            style={{ fontSize: 4 }}
          >
            {label.slice(0, 8)}
          </text>
        ))}
        {destinations.map((label, lane) => (
          <text
            key={`bottom-${lane}`}
            x={laneX(lane)}
            y={98}
            textAnchor="middle"
            className="fill-slate-700"
            style={{ fontSize: 3.5 }}
          >
            {label.slice(0, 10)}
          </text>
        ))}
        {Array.from({ length: laneCount }).map((_, lane) => (
          <line
            key={`v-${lane}`}
            x1={laneX(lane)}
            y1={SVG_TOP}
            x2={laneX(lane)}
            y2={SVG_BOTTOM}
            stroke="#475569"
            strokeWidth={0.8}
          />
        ))}
        {rungs.map((rung, idx) => {
          const x1 = laneX(rung.leftLane);
          const x2 = laneX(rung.leftLane + 1);
          const y = rowY(rung.row);
          return (
            <line
              key={`h-${idx}-${rung.leftLane}-${rung.row}`}
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              stroke={rung.drawnBy ? '#6366f1' : '#334155'}
              strokeWidth={rung.drawnBy ? 1.4 : 1.1}
              strokeLinecap="round"
            />
          );
        })}
        {options.showResultPaths &&
          participantIds.map((_, startLane) => {
            const pathPoints = traceLadderPathPoints(
              startLane,
              rungs,
              LADDER_ROW_COUNT,
              laneX,
              rowY,
              SVG_TOP,
              SVG_BOTTOM,
            );
            const color = getLadderPathColor(startLane);
            return (
              <path
                key={`path-${startLane}`}
                d={pointsToSvgPath(pathPoints)}
                fill="none"
                stroke={color}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            );
          })}
        {options.interactive &&
          Array.from({ length: LADDER_ROW_COUNT }).map((_, row) =>
            Array.from({ length: laneCount - 1 }).map((_, leftLane) => {
              const taken = rungs.some((r) => r.leftLane === leftLane && r.row === row);
              if (taken) return null;
              const cx = (laneX(leftLane) + laneX(leftLane + 1)) / 2;
              const cy = rowY(row);
              return (
                <circle
                  key={`hit-${leftLane}-${row}`}
                  cx={cx}
                  cy={cy}
                  r={2.2}
                  className={
                    userHasDrawn
                      ? 'fill-transparent'
                      : 'cursor-pointer fill-indigo-400/30 hover:fill-indigo-500/50'
                  }
                  onClick={() => handleRungClick(leftLane, row)}
                />
              );
            }),
          )}
      </svg>
    </div>
  );

  if (members.length === 0) {
    return (
      <p className="text-[#64748b]" style={{ fontSize: '4.5cqmin' }}>
        {t.no_members}
      </p>
    );
  }

  if (isSetup) {
    return (
      <div className="games-tab-panel games-tab-setup">
        <div className="games-setup-columns">
          <div className="min-h-0 min-w-0">
            <div className="font-semibold text-[#334155]" style={{ fontSize: '4.5cqmin', marginBottom: '1.5cqmin' }}>
              {t.ladder_participants}
            </div>
            <div className="games-field-list grid">
              {participantIds.map((value, index) => (
                <MemberSelect
                  key={`p-${index}`}
                  members={members}
                  value={value}
                  onChange={(next) => updateParticipant(index, next)}
                  placeholder={t.ladder_participant_ph}
                  currentUserId={userId}
                  youLabel={t.ladder_you}
                  excludeUserIds={participantIds.filter((_, i) => i !== index)}
                />
              ))}
            </div>
          </div>
          <div className="min-h-0 min-w-0">
            <div className="font-semibold text-[#334155]" style={{ fontSize: '4.5cqmin', marginBottom: '1.5cqmin' }}>
              {t.ladder_destinations}
            </div>
            <div className="games-field-list grid">
              {destinations.map((value, index) => (
                <input
                  key={`d-${index}`}
                  value={value}
                  onChange={(e) => updateDestination(index, e.target.value)}
                  placeholder={t.ladder_destination_ph}
                  className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-[#1e293b] outline-none focus:border-indigo-400"
                  style={{ fontSize: '4.5cqmin' }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="games-setup-actions flex flex-shrink-0 flex-wrap" style={{ gap: '1.5cqmin' }}>
          <button
            type="button"
            onClick={participantsReady ? launchLadderGame : addPair}
            disabled={
              participantsReady
                ? false
                : laneCount >= LADDER_MAX_LANES || laneCount >= members.length
            }
            className={`rounded-lg px-3 py-2 font-semibold text-white disabled:opacity-50 ${
              participantsReady ? 'bg-emerald-600' : 'bg-indigo-600'
            }`}
            style={{ fontSize: '4cqmin' }}
          >
            {participantsReady ? props.launchLabel : t.ladder_add_pair}
          </button>
          <button
            type="button"
            onClick={removePair}
            disabled={laneCount <= LADDER_MIN_LANES || participantsReady}
            className="rounded-lg bg-slate-200 px-3 py-2 font-semibold text-slate-700 disabled:opacity-50"
            style={{ fontSize: '4cqmin' }}
          >
            {t.ladder_remove_pair}
          </button>
        </div>

        {!participantsReady && (
          <p className="flex-shrink-0 text-[#64748b]" style={{ fontSize: '4cqmin' }}>
            {t.ladder_min_players}
          </p>
        )}
      </div>
    );
  }

  if (phase === 'result') {
    return (
      <div className="grid" style={{ gap: '2cqmin' }}>
        <div className="flex flex-wrap items-center justify-between" style={{ gap: '1.5cqmin' }}>
          <p className="font-semibold text-[#1e293b]" style={{ fontSize: '4.5cqmin' }}>
            {t.ladder_result_title}
          </p>
          <button
            type="button"
            onClick={resetPlay}
            className="rounded-lg bg-slate-200 px-3 py-1.5 font-semibold text-slate-700"
            style={{ fontSize: '4cqmin' }}
          >
            {t.ladder_reset}
          </button>
        </div>
        {renderLadderSvg(displayRungs, { interactive: false, showResultPaths: showPaths })}
        {showPaths && (
          <ul className="m-0 list-none p-0" style={{ gap: '1cqmin' }}>
            {results.map((r, i) => (
              <li
                key={i}
                className="glass-panel-soft rounded-lg text-[#1e293b]"
                style={{
                  padding: '2cqmin 2.5cqmin',
                  fontSize: '4.5cqmin',
                  marginBottom: '1cqmin',
                  borderLeft: `4px solid ${getLadderPathColor(r.startLane)}`,
                }}
              >
                {formatText(t.ladder_path_result, { from: r.from, to: r.to })}
              </li>
            ))}
          </ul>
        )}
        {isRevealing && (
          <p className="text-center font-medium text-indigo-600" style={{ fontSize: '4cqmin' }}>
            …
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: '2cqmin' }}>
      <p className="text-[#475569]" style={{ fontSize: '4cqmin' }}>
        {t.ladder_draw_hint}
      </p>

      <div className="flex flex-wrap items-center justify-between" style={{ gap: '1.5cqmin' }}>
        <div className="flex flex-wrap items-center" style={{ gap: '1cqmin' }}>
          <MemberSelect
            members={participantMembers}
            value={activeDrawerId}
            onChange={setActiveDrawerId}
            placeholder={t.select_member}
            currentUserId={userId}
            youLabel={t.ladder_you}
          />
          {userHasDrawn && (
            <span
              className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800"
              style={{ fontSize: '3.5cqmin' }}
            >
              {formatText(t.ladder_drawn_by, {
                name: getMemberNickname(members, activeDrawerId, userId, t.ladder_you),
              })}
            </span>
          )}
        </div>
        <span className="font-medium text-indigo-700" style={{ fontSize: '4cqmin' }}>
          {formatText(t.ladder_draw_progress, {
            done: String(drawnParticipantIds.size),
            total: String(participantIds.length),
          })}
        </span>
      </div>

      <div className="flex flex-wrap" style={{ gap: '1cqmin' }}>
        {participantIds.map((id) => {
          const done = drawnParticipantIds.has(id);
          const name = getMemberNickname(members, id, userId, t.ladder_you);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveDrawerId(id)}
              className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                activeDrawerId === id
                  ? 'bg-indigo-600 text-white'
                  : done
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-700'
              }`}
              style={{ fontSize: '3.5cqmin' }}
            >
              {name}
              {done ? ' ✓' : ''}
            </button>
          );
        })}
      </div>

      {renderLadderSvg(userRungs, { interactive: true, showResultPaths: false })}

      <p className="text-center text-[#64748b]" style={{ fontSize: '4cqmin' }}>
        {t.ladder_start_hint}
      </p>

      <button
        type="button"
        onClick={startLadder}
        disabled={isRevealing}
        className="rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white disabled:opacity-50"
        style={{ fontSize: '4.5cqmin' }}
      >
        {t.ladder_start}
      </button>
    </div>
  );
}
