'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { FamilyTaskMemberOption } from '@/app/features/family-tasks/types';
import { asLadderConfig } from '@/lib/family-games/session-types';
import type { FamilyGameSessionBundle, GameSessionAction } from '@/lib/family-games/session-types';
import {
  LADDER_MAX_LANES,
  LADDER_MIN_LANES,
  LADDER_ROW_COUNT,
  getLadderPathColor,
  pointsToSvgPath,
  traceLadderPath,
  traceLadderPathPoints,
  type LadderLaunchConfig,
  type LadderRung,
} from '../types';
import { getMemberNickname, MemberSelect } from './MemberSelect';
import { areParticipantSlotsReady, ParticipantSetupPicker } from './ParticipantSetupPicker';
import {
  allStartLanesAssigned,
  getLadderLaneLetter,
  getLadderVisualLaneCount,
  getOccupantAtLane,
  getUserStartLane,
  isLadderTripleLaneMode,
  normalizeLadderDestinationsLength,
} from '@/lib/family-games/ladder-helpers';

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
  ladder_pick_lane: string;
  ladder_lane_empty: string;
  ladder_lanes_not_ready: string;
  games_waiting_host: string;
  games_cancel: string;
  games_add_member: string;
  games_remove_member: string;
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
  onLaunch: (config: LadderLaunchConfig) => void | Promise<void>;
  disabled?: boolean;
};

type LadderGameTabMultiplayerProps = LadderGameTabBaseProps & {
  mode: 'multiplayer';
  sessionBundle: FamilyGameSessionBundle;
  isHost: boolean;
  onAction: (action: GameSessionAction) => Promise<unknown>;
  actionLoading?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
};

export type LadderGameTabProps = LadderGameTabSetupProps | LadderGameTabMultiplayerProps;

const SVG_W = 100;
const SVG_H = 112;
/** Top participant labels */
const LABEL_TOP_Y = 11;
/** Bottom destination labels */
const LABEL_BOTTOM_Y = 105;
/** Vertical rails start/end (inside label padding) */
const SVG_TOP = 18;
const SVG_BOTTOM = 96;
const VERTICAL_STROKE_MS = 650;
const HORIZONTAL_RUNG_MS = 35;
const LEGACY_RESULT_DESTINATION_RE = /^Result \d+$/;

/** Server/legacy placeholder labels → empty so the input placeholder shows instead */
function normalizeDestinationDisplay(
  value: string,
  index: number,
  placeholder: string,
): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (LEGACY_RESULT_DESTINATION_RE.test(trimmed)) return '';
  if (trimmed === `${placeholder} ${index + 1}`) return '';
  return value;
}

function normalizeDestinationsDisplay(
  values: string[],
  placeholder: string,
): string[] {
  return values.map((value, index) => normalizeDestinationDisplay(value, index, placeholder));
}

export function LadderGameTab(props: LadderGameTabProps) {
  const { userId, members, translations: t, formatText, mode } = props;
  const isSetup = mode === 'setup';
  const isMultiplayer = mode === 'multiplayer';

  const mpConfig = isMultiplayer ? asLadderConfig(props.sessionBundle.session.config) : null;
  const mpSession = isMultiplayer ? props.sessionBundle.session : null;
  const mpParticipants = isMultiplayer ? props.sessionBundle.participants : [];
  const myParticipant = mpParticipants.find((p) => p.user_id === userId) ?? null;

  const [participantIds, setParticipantIds] = useState<string[]>(
    mpConfig?.participantIds ?? ['', ''],
  );
  const [destinations, setDestinations] = useState<string[]>(() =>
    mpConfig?.destinations
      ? normalizeDestinationsDisplay(mpConfig.destinations, t.ladder_destination_ph)
      : ['', ''],
  );
  const [displayRungs, setDisplayRungs] = useState<LadderRung[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showPaths, setShowPaths] = useState(false);
  const [verticalRevealDone, setVerticalRevealDone] = useState(true);
  const [verticalDrawActive, setVerticalDrawActive] = useState(true);

  const configDestinationsKey = mpConfig?.destinations.join('|') ?? '';
  const configParticipantIdsKey = mpConfig?.participantIds.join('|') ?? '';
  const destinationsRef = useRef(destinations);
  const userRungs = mpConfig?.userRungs ?? [];
  const finalRungs = mpConfig?.finalRungs ?? [];
  const mpPhase =
    mpSession?.status === 'active' && mpSession?.phase === 'draw'
      ? 'draw'
      : mpSession?.status === 'revealing' || mpSession?.status === 'completed'
        ? 'result'
        : mpSession?.status === 'config' && mpSession?.phase !== 'lobby'
          ? 'config'
          : 'config';

  useEffect(() => {
    destinationsRef.current = destinations;
  }, [destinations]);

  useEffect(() => {
    if (!mpConfig) return;
    setParticipantIds((prev) => {
      const next = mpConfig.participantIds;
      return prev.join('|') === next.join('|') ? prev : next;
    });
  }, [configParticipantIdsKey, mpConfig]);

  useEffect(() => {
    if (!mpConfig) return;
    if (mpPhase === 'config') {
      setDestinations((prev) => {
        const targetLen = getLadderVisualLaneCount(mpConfig.participantIds.length);
        if (prev.length === targetLen) return prev;
        return normalizeDestinationsDisplay(
          normalizeLadderDestinationsLength(mpConfig.destinations, mpConfig.participantIds.length),
          t.ladder_destination_ph,
        );
      });
      return;
    }
    setDestinations((prev) => {
      const next = mpConfig.destinations;
      return prev.join('|') === next.join('|') ? prev : next;
    });
  }, [configDestinationsKey, mpConfig, mpPhase, t.ladder_destination_ph]);

  useEffect(() => {
    if (!isMultiplayer || mpPhase !== 'result' || finalRungs.length === 0) return;
    if (mpSession?.status === 'completed') {
      setVerticalRevealDone(true);
      setVerticalDrawActive(true);
      setDisplayRungs(finalRungs);
      setShowPaths(true);
      setIsRevealing(false);
      return;
    }

    const userDrawn = userRungs;
    const autoRungs = finalRungs.filter((r) => !r.drawnBy);
    setIsRevealing(true);
    setShowPaths(false);
    setDisplayRungs([]);
    setVerticalRevealDone(false);
    setVerticalDrawActive(false);

    let rungTimer: number | undefined;
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setVerticalDrawActive(true));
    });
    const verticalDuration =
      VERTICAL_STROKE_MS + Math.max(0, participantIds.length - 1) * 40;

    const verticalTimer = window.setTimeout(() => {
      setVerticalRevealDone(true);
      setDisplayRungs([...userDrawn]);
      let index = 0;
      rungTimer = window.setInterval(() => {
        if (index >= autoRungs.length) {
          window.clearInterval(rungTimer!);
          setIsRevealing(false);
          window.setTimeout(() => setShowPaths(true), 200);
          if (props.mode === 'multiplayer' && props.isHost && mpSession?.status === 'revealing') {
            props.onAction({ type: 'host_complete_ladder' }).catch(console.error);
          }
          return;
        }
        const next = autoRungs[index];
        setDisplayRungs((prev) => [...prev, next]);
        index += 1;
      }, HORIZONTAL_RUNG_MS);
    }, verticalDuration);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(verticalTimer);
      if (rungTimer !== undefined) window.clearInterval(rungTimer);
    };
  }, [
    isMultiplayer,
    mpPhase,
    mpSession?.status,
    finalRungs,
    userRungs,
    participantIds.length,
    mpConfig?.revealStartedAt,
  ]);

  const laneCount = getLadderVisualLaneCount(participantIds.length);
  const isTripleLane = isLadderTripleLaneMode(participantIds.length);
  const startLanes = mpConfig?.startLanes ?? {};
  const lanesReady = allStartLanesAssigned(participantIds, startLanes);

  const participantsReady = useMemo(() => {
    const idsOk =
      participantIds.every((id) => id.trim()) &&
      new Set(participantIds).size === participantIds.length;
    return idsOk && participantIds.length >= LADDER_MIN_LANES && members.length > 0;
  }, [participantIds, members.length]);

  const topLaneLabels = useMemo(
    () =>
      Array.from({ length: laneCount }, (_, lane) => {
        const occupantId = getOccupantAtLane(lane, participantIds, startLanes);
        if (occupantId) {
          return getMemberNickname(members, occupantId, userId, t.ladder_you);
        }
        if (isTripleLane) return getLadderLaneLetter(lane);
        return '';
      }),
    [laneCount, participantIds, startLanes, members, userId, t.ladder_you, isTripleLane],
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

  const userHasDrawn = isMultiplayer
    ? Boolean(myParticipant?.ready)
    : drawnParticipantIds.has(userId);

  const results = useMemo(() => {
    if (mpPhase !== 'result' || finalRungs.length === 0) return [];
    return participantIds.map((fromId) => {
      const startLane = getUserStartLane(fromId, participantIds, startLanes);
      const endLane = traceLadderPath(startLane, finalRungs, LADDER_ROW_COUNT);
      const from = getMemberNickname(members, fromId, userId, t.ladder_you);
      const to = destinations[endLane] ?? '';
      return { from, to, startLane, endLane };
    });
  }, [mpPhase, participantIds, destinations, finalRungs, members, userId, t.ladder_you, startLanes]);

  const svgWidth = SVG_W;
  const laneX = (lane: number) => (lane / Math.max(1, laneCount - 1)) * svgWidth;
  const rowY = (row: number) =>
    SVG_TOP + (row / Math.max(1, LADDER_ROW_COUNT - 1)) * (SVG_BOTTOM - SVG_TOP);
  const verticalRailLength = SVG_BOTTOM - SVG_TOP;
  const topLabelFontSize = laneCount > 5 ? 3.2 : 3.8;
  const bottomLabelFontSize = laneCount > 5 ? 2.8 : 3.2;
  const topLabelMaxLen = laneCount > 5 ? 5 : 8;
  const bottomLabelMaxLen = laneCount > 5 ? 6 : 10;

  const updateParticipant = (index: number, value: string) => {
    if (mode !== 'multiplayer' || !props.isHost || mpPhase !== 'draw') return;
    const next = participantIds.map((p, i) => (i === index ? value : p));
    setParticipantIds(next);
    props.onAction({ type: 'update_ladder_config', participantIds: next }).catch(console.error);
  };

  const updateDestination = (index: number, value: string) => {
    setDestinations((prev) => prev.map((d, i) => (i === index ? value : d)));
  };

  const handleDestinationBlur = (index: number) => {
    if (mode !== 'multiplayer' || props.isHost || mpPhase !== 'config') return;
    if (myParticipant?.slot_index !== index) return;
    const value = destinationsRef.current[index]?.trim() ?? '';
    props
      .onAction({ type: 'submit_ladder_setup_destination', destination: value })
      .catch(console.error);
  };

  const addPair = () => {
    if (mode !== 'multiplayer' || !props.isHost || mpPhase !== 'draw') return;
    if (laneCount >= LADDER_MAX_LANES || laneCount >= members.length) return;
    props.onAction({ type: 'update_ladder_config', addLane: true }).catch(console.error);
  };

  const removePair = () => {
    if (mode !== 'multiplayer' || !props.isHost || mpPhase !== 'draw') return;
    if (laneCount <= LADDER_MIN_LANES) return;
    props.onAction({ type: 'update_ladder_config', removeLane: true }).catch(console.error);
  };

  const renderLaneControls = () => {
    if (mode !== 'multiplayer' || !props.isHost || mpPhase !== 'draw') return null;
    const mp = props;
    const hasEmptySlot = participantIds.some((id) => !id.trim());
    return (
      <div className="grid" style={{ gap: '1.5cqmin' }}>
        {hasEmptySlot && (
          <div className="games-field-list grid">
            {participantIds.map((value, index) =>
              value.trim() ? null : (
                <MemberSelect
                  key={`draw-p-${index}`}
                  members={members}
                  value={value}
                  onChange={(next) => updateParticipant(index, next)}
                  placeholder={t.ladder_participant_ph}
                  currentUserId={userId}
                  youLabel={t.ladder_you}
                  excludeUserIds={participantIds.filter((id, i) => i !== index && id.trim())}
                />
              ),
            )}
          </div>
        )}
        <div className="flex flex-wrap" style={{ gap: '1.5cqmin' }}>
          <button
            type="button"
            onClick={addPair}
            disabled={
              laneCount >= LADDER_MAX_LANES ||
              laneCount >= members.length ||
              mp.actionLoading
            }
            className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white disabled:opacity-50"
            style={{ fontSize: '4cqmin' }}
          >
            {t.ladder_add_pair}
          </button>
          <button
            type="button"
            onClick={removePair}
            disabled={laneCount <= LADDER_MIN_LANES || mp.actionLoading}
            className="rounded-lg bg-slate-200 px-3 py-2 font-semibold text-slate-700 disabled:opacity-50"
            style={{ fontSize: '4cqmin' }}
          >
            {t.ladder_remove_pair}
          </button>
        </div>
      </div>
    );
  };

  const launchLadderGame = () => {
    if (mode !== 'setup' || !participantsReady) return;
    props.onLaunch({
      participantIds: [...participantIds],
      destinations: participantIds.map((_, index) => `${t.ladder_destination_ph} ${index + 1}`),
    });
  };

  const beginDrawPhase = () => {
    if (mode !== 'multiplayer' || !props.isHost) return;
    props
      .onAction({
        type: 'host_begin_draw',
        destinations: normalizeLadderDestinationsLength(
          destinationsRef.current.map((d) => d.trim()),
          participantIds.length,
        ),
      })
      .catch(console.error);
  };

  const selectStartLane = (laneIndex: number) => {
    if (mode !== 'multiplayer' || !isTripleLane || mpPhase !== 'config') return;
    props.onAction({ type: 'select_ladder_start_lane', laneIndex }).catch(console.error);
  };

  const handleRungClick = (leftLane: number, row: number) => {
    if (mode !== 'multiplayer' || mpPhase !== 'draw' || userHasDrawn || isRevealing) return;
    if (!participantIds.includes(userId)) return;
    props.onAction({ type: 'draw_rung', leftLane, row }).catch(console.error);
  };

  const startLadder = () => {
    if (mode !== 'multiplayer' || !props.isHost) return;
    props.onAction({ type: 'host_start_ladder' }).catch(console.error);
  };

  const renderLadderConfig = () => {
    if (mode !== 'multiplayer') return null;
    const mp = props;
    return (
    <div className="grid" style={{ gap: '2.5cqmin' }}>
      <div className="grid sm:grid-cols-2" style={{ gap: '2.5cqmin' }}>
        <div>
          <div className="font-semibold text-[#334155]" style={{ fontSize: '4.5cqmin', marginBottom: '1.5cqmin' }}>
            {t.ladder_participants}
          </div>
          <div className="games-field-list grid">
            {participantLabels.map((label, index) => (
              <div
                key={`p-${participantIds[index]}-${index}`}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 font-medium text-[#1e293b]"
                style={{ fontSize: '4.5cqmin' }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="font-semibold text-[#334155]" style={{ fontSize: '4.5cqmin', marginBottom: '1.5cqmin' }}>
            {t.ladder_destinations}
          </div>
          <div className="games-field-list grid">
            {destinations.map((value, index) => {
              const canEdit =
                mp.isHost || (!isTripleLane && myParticipant?.slot_index === index);
              return (
                <input
                  key={`d-${index}`}
                  value={value}
                  onChange={(e) => updateDestination(index, e.target.value)}
                  onBlur={() => handleDestinationBlur(index)}
                  placeholder={t.ladder_destination_ph}
                  disabled={!canEdit}
                  className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-[#1e293b] outline-none focus:border-indigo-400 disabled:opacity-60"
                  style={{ fontSize: '4.5cqmin' }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {isTripleLane && (
        <div className="grid" style={{ gap: '1.5cqmin' }}>
          <div className="font-semibold text-[#334155]" style={{ fontSize: '4.5cqmin' }}>
            {t.ladder_pick_lane}
          </div>
          <div className="flex flex-wrap" style={{ gap: '1.5cqmin' }}>
            {Array.from({ length: laneCount }, (_, lane) => {
              const occupantId = getOccupantAtLane(lane, participantIds, startLanes);
              const isMine = occupantId === userId;
              const isTaken = Boolean(occupantId && !isMine);
              const canPick = participantIds.includes(userId);
              const occupantLabel = occupantId
                ? getMemberNickname(members, occupantId, userId, t.ladder_you)
                : t.ladder_lane_empty;
              return (
                <button
                  key={`lane-${lane}`}
                  type="button"
                  onClick={() => selectStartLane(lane)}
                  disabled={!canPick || mp.actionLoading || (isTaken && !isMine)}
                  className={`min-w-[22cqmin] rounded-xl border px-3 py-2 text-left transition-colors ${
                    isMine
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                      : occupantId
                        ? 'border-slate-200 bg-slate-50 text-slate-600'
                        : 'border-dashed border-slate-300 bg-white text-slate-700 hover:border-indigo-300'
                  } disabled:opacity-50`}
                  style={{ fontSize: '4cqmin' }}
                >
                  <span className="block font-bold">{getLadderLaneLetter(lane)}</span>
                  <span className="block text-[#64748b]" style={{ fontSize: '3.5cqmin' }}>
                    {occupantLabel}
                  </span>
                </button>
              );
            })}
          </div>
          {!lanesReady && (
            <p className="text-[#64748b]" style={{ fontSize: '3.5cqmin' }}>
              {t.ladder_lanes_not_ready}
            </p>
          )}
        </div>
      )}

      {!participantsReady && (
        <p className="text-[#64748b]" style={{ fontSize: '4cqmin' }}>
          {t.ladder_min_players}
        </p>
      )}

      {mp.isHost ? (
        <button
          type="button"
          onClick={beginDrawPhase}
          disabled={!participantsReady || !lanesReady || mp.actionLoading}
          className="rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white disabled:opacity-50"
          style={{ fontSize: '4.5cqmin' }}
        >
          {t.ladder_start}
        </button>
      ) : (
        <p className="text-[#64748b]" style={{ fontSize: '4cqmin' }}>
          {t.games_waiting_host}
        </p>
      )}

      {mp.onCancel && (
        <button
          type="button"
          onClick={mp.onCancel}
          className="rounded-lg bg-slate-200 px-3 py-2 font-semibold text-slate-700"
          style={{ fontSize: '4cqmin' }}
        >
          {mp.cancelLabel ?? t.games_cancel}
        </button>
      )}
    </div>
    );
  };

  const renderLadderSvg = (
    rungs: LadderRung[],
    options: {
      interactive: boolean;
      showResultPaths: boolean;
      animateVerticalReveal?: boolean;
    },
  ) => (
    <div
      className="glass-panel-soft overflow-x-auto rounded-xl"
      style={{ padding: '2cqmin', overflowY: 'visible' }}
    >
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="mx-auto w-full max-w-full"
        style={{ minHeight: '48cqmin', overflow: 'visible' }}
        role="img"
        aria-label="ladder"
      >
        {topLaneLabels.map((label, lane) => (
          <text
            key={`top-${lane}`}
            x={laneX(lane)}
            y={LABEL_TOP_Y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-slate-800 font-semibold"
            style={{ fontSize: topLabelFontSize }}
          >
            {label.slice(0, topLabelMaxLen)}
          </text>
        ))}
        {destinations.map((label, lane) => (
          <text
            key={`bottom-${lane}`}
            x={laneX(lane)}
            y={LABEL_BOTTOM_Y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-slate-700"
            style={{ fontSize: bottomLabelFontSize }}
          >
            {label.slice(0, bottomLabelMaxLen)}
          </text>
        ))}
        {Array.from({ length: laneCount }).map((_, lane) => {
          const x = laneX(lane);
          const animatingVertical = Boolean(options.animateVerticalReveal && !verticalRevealDone);
          const dashOffset =
            animatingVertical && !verticalDrawActive ? verticalRailLength : 0;
          return (
            <line
              key={`v-${lane}`}
              x1={x}
              y1={SVG_TOP}
              x2={x}
              y2={SVG_BOTTOM}
              stroke="#475569"
              strokeWidth={0.85}
              strokeLinecap="round"
              strokeDasharray={verticalRailLength}
              strokeDashoffset={dashOffset}
              style={
                animatingVertical && verticalDrawActive
                  ? {
                      transition: `stroke-dashoffset ${VERTICAL_STROKE_MS}ms ease-out`,
                      transitionDelay: `${lane * 40}ms`,
                    }
                  : undefined
              }
            />
          );
        })}
        {(options.animateVerticalReveal ? verticalRevealDone : true) &&
          rungs.map((rung, idx) => {
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
        {(options.animateVerticalReveal ? verticalRevealDone : true) &&
          options.showResultPaths &&
          participantIds.map((participantId) => {
            const startLane = getUserStartLane(participantId, participantIds, startLanes);
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
                key={`path-${participantId}`}
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
        {(options.animateVerticalReveal ? verticalRevealDone : true) &&
          options.interactive &&
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
    const setupMaxSlots = Math.min(members.length, LADDER_MAX_LANES);
    return (
      <div className="games-tab-panel games-tab-setup">
        <ParticipantSetupPicker
          members={members}
          userId={userId}
          slotIds={participantIds}
          onSlotIdsChange={setParticipantIds}
          minSlots={LADDER_MIN_LANES}
          maxSlots={setupMaxSlots}
          selectPlaceholder={t.select_member}
          youLabel={t.ladder_you}
          addLabel={t.games_add_member}
          removeLabel={t.games_remove_member}
        />
        <button
          type="button"
          onClick={launchLadderGame}
          disabled={!participantsReady || props.disabled}
          className="games-setup-actions w-full flex-shrink-0 rounded-lg bg-emerald-600 px-3 py-2.5 font-semibold text-white disabled:opacity-50"
          style={{ fontSize: '4.5cqmin' }}
        >
          {props.launchLabel}
        </button>
      </div>
    );
  }

  if (mpPhase === 'config') {
    return renderLadderConfig();
  }

  if (mpPhase === 'result') {
    const isLiveReveal = mpSession?.status === 'revealing';
    const rungsToShow = isLiveReveal
      ? displayRungs
      : finalRungs;
    return (
      <div className="grid" style={{ gap: '2cqmin' }}>
        <p className="font-semibold text-[#1e293b]" style={{ fontSize: '4.5cqmin' }}>
          {t.ladder_result_title}
        </p>
        {renderLadderSvg(rungsToShow, {
          interactive: false,
          showResultPaths: showPaths,
          animateVerticalReveal: isLiveReveal,
        })}
        {showPaths && (
          <ul className="m-0 list-none p-0">
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
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: '2cqmin' }}>
      <p className="text-[#475569]" style={{ fontSize: '4cqmin' }}>
        {participantIds.includes(userId)
          ? t.ladder_draw_hint
          : t.games_waiting_host}
      </p>

      <span className="font-medium text-indigo-700" style={{ fontSize: '4cqmin' }}>
        {formatText(t.ladder_draw_progress, {
          done: String(drawnParticipantIds.size),
          total: String(participantIds.length),
        })}
      </span>

      <div className="flex flex-wrap" style={{ gap: '1cqmin' }}>
        {participantIds.map((id) => {
          const done = drawnParticipantIds.has(id);
          const name = getMemberNickname(members, id, userId, t.ladder_you);
          return (
            <span
              key={id}
              className={`rounded-full px-2.5 py-1 font-medium ${
                done ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
              }`}
              style={{ fontSize: '3.5cqmin' }}
            >
              {name}
              {done ? ' ✓' : ''}
            </span>
          );
        })}
      </div>

      {renderLaneControls()}

      {renderLadderSvg(userRungs, {
        interactive: participantIds.includes(userId),
        showResultPaths: false,
      })}

      {userHasDrawn && (
        <p className="text-center text-emerald-700" style={{ fontSize: '4cqmin' }}>
          {formatText(t.ladder_drawn_by, {
            name: getMemberNickname(members, userId, userId, t.ladder_you),
          })}
        </p>
      )}

      {props.isHost && (
        <>
          <p className="text-center text-[#64748b]" style={{ fontSize: '4cqmin' }}>
            {t.ladder_start_hint}
          </p>
          <button
            type="button"
            onClick={startLadder}
            disabled={props.actionLoading || isRevealing}
            className="rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white disabled:opacity-50"
            style={{ fontSize: '4.5cqmin' }}
          >
            {t.ladder_start}
          </button>
        </>
      )}
    </div>
  );
}
