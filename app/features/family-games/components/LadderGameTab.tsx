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
import { GameResultCelebration } from './GameResultCelebration';
import {
  allStartLanesAssigned,
  collectStartLanesFromParticipants,
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
  ladder_result_announce: string;
  ladder_path_result: string;
  ladder_pick_lane: string;
  ladder_lane_empty: string;
  ladder_lanes_not_ready: string;
  games_waiting_host: string;
  games_cancel: string;
  games_add_member: string;
  games_remove_member: string;
  games_congrats_title: string;
  games_congrats_dismiss: string;
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
const HOST_DESTINATIONS_SAVE_DEBOUNCE_MS = 400;
const PATH_DESCEND_MS = 1600;
const USER_RUNG_REVEAL_MS = 450;
const LEGACY_RESULT_DESTINATION_RE = /^Result \d+$/;

function DescendingLadderPath({
  d,
  color,
  animate,
}: {
  d: string;
  color: string;
  animate: boolean;
}) {
  const ref = useRef<SVGPathElement>(null);
  const [dash, setDash] = useState<{ len: number; offset: number; run: boolean } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !animate) {
      setDash(null);
      return undefined;
    }
    const len = el.getTotalLength();
    setDash({ len, offset: len, run: false });
    let frame2 = 0;
    const frame1 = window.requestAnimationFrame(() => {
      frame2 = window.requestAnimationFrame(() => {
        setDash({ len, offset: 0, run: true });
      });
    });
    return () => {
      window.cancelAnimationFrame(frame1);
      window.cancelAnimationFrame(frame2);
    };
  }, [animate, d]);

  return (
    <path
      ref={ref}
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={animate && !dash ? 0 : 0.85}
      style={
        dash
          ? {
              strokeDasharray: dash.len,
              strokeDashoffset: dash.offset,
              transition: dash.run ? `stroke-dashoffset ${PATH_DESCEND_MS}ms linear` : 'none',
            }
          : undefined
      }
    />
  );
}

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
  const mpIsHost = isMultiplayer ? props.isHost : false;

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
  const [showPaths, setShowPaths] = useState(false);
  const [celebrationDismissedKey, setCelebrationDismissedKey] = useState<string | null>(null);

  const configDestinationsKey = mpConfig?.destinations.join('|') ?? '';
  const configParticipantIdsKey = mpConfig?.participantIds.join('|') ?? '';
  const destinationsRef = useRef(destinations);
  const hostDestinationsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ladderRevealAnimRef = useRef<{ key: string; done: boolean }>({ key: '', done: false });
  const userRungs = mpConfig?.userRungs ?? [];
  const baseRungs = mpConfig?.baseRungs ?? [];
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
      const next = normalizeDestinationsDisplay(
        normalizeLadderDestinationsLength(mpConfig.destinations, mpConfig.participantIds.length),
        t.ladder_destination_ph,
      );
      setDestinations((prev) => {
        if (isMultiplayer && mpIsHost) {
          if (prev.length !== next.length) return next;
          return prev;
        }
        return prev.join('|') === next.join('|') ? prev : next;
      });
      return;
    }
    setDestinations((prev) => {
      const next = mpConfig.destinations;
      return prev.join('|') === next.join('|') ? prev : next;
    });
  }, [configDestinationsKey, mpConfig, mpPhase, t.ladder_destination_ph, isMultiplayer, mpIsHost]);

  useEffect(
    () => () => {
      if (hostDestinationsTimerRef.current) {
        clearTimeout(hostDestinationsTimerRef.current);
      }
    },
    [],
  );

  const baseRungKey = baseRungs.map((r) => `${r.leftLane}:${r.row}`).join(',');
  const userRungKey = userRungs.map((r) => `${r.leftLane}:${r.row}:${r.drawnBy ?? ''}`).join(',');
  const ladderRungsRef = useRef({ baseRungs, userRungs, finalRungs });
  ladderRungsRef.current = { baseRungs, userRungs, finalRungs };

  useEffect(() => {
    if (!isMultiplayer || mpPhase !== 'result' || finalRungs.length === 0) return;

    const animKey = `${mpSession?.id ?? ''}:${mpConfig?.revealStartedAt ?? ''}`;
    const { baseRungs: baseSource, userRungs: selected, finalRungs: finals } = ladderRungsRef.current;
    const base = baseSource.length > 0 ? baseSource : finals.filter((r) => !r.drawnBy);
    const withSelected = baseSource.length > 0 ? [...base, ...selected] : finals;

    const showFinalState = () => {
      setDisplayRungs(finals);
      setShowPaths(true);
    };

    const alreadyDone =
      mpSession?.status === 'completed' ||
      (ladderRevealAnimRef.current.key === animKey && ladderRevealAnimRef.current.done);

    if (alreadyDone) {
      ladderRevealAnimRef.current = { key: animKey, done: true };
      showFinalState();
      return;
    }

    ladderRevealAnimRef.current = { key: animKey, done: false };
    setShowPaths(false);
    setDisplayRungs(base);

    const addSelectedTimer = window.setTimeout(() => {
      setDisplayRungs(withSelected);
    }, USER_RUNG_REVEAL_MS);
    const pathTimer = window.setTimeout(() => {
      setShowPaths(true);
    }, USER_RUNG_REVEAL_MS + 280);
    const doneTimer = window.setTimeout(() => {
      ladderRevealAnimRef.current = { key: animKey, done: true };
      if (props.mode === 'multiplayer' && props.isHost && mpSession?.status === 'revealing') {
        props.onAction({ type: 'host_complete_ladder' }).catch(console.error);
      }
    }, USER_RUNG_REVEAL_MS + 280 + PATH_DESCEND_MS);

    return () => {
      window.clearTimeout(addSelectedTimer);
      window.clearTimeout(pathTimer);
      window.clearTimeout(doneTimer);
    };
  }, [
    isMultiplayer,
    mpPhase,
    mpSession?.id,
    mpSession?.status,
    mpConfig?.revealStartedAt,
    finalRungs.length,
    baseRungKey,
    userRungKey,
  ]);

  const laneCount = getLadderVisualLaneCount(participantIds.length);
  const isTripleLane = isLadderTripleLaneMode(participantIds.length);
  const startLanes = useMemo(
    () =>
      collectStartLanesFromParticipants(
        mpParticipants,
        participantIds,
        mpConfig?.startLanes,
      ),
    [mpParticipants, participantIds, mpConfig?.startLanes],
  );
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

  const topLabelFontSize = laneCount > 5 ? 3.2 : 3.8;
  const bottomLabelFontSize = laneCount > 5 ? 2.8 : 3.2;
  const railPad = 8;
  const laneX = (lane: number) => {
    if (laneCount <= 1) return SVG_W / 2;
    return railPad + (lane / (laneCount - 1)) * (SVG_W - railPad * 2);
  };
  const labelAnchor = (lane: number): 'start' | 'middle' | 'end' => {
    if (laneCount <= 1) return 'middle';
    if (lane === 0) return 'start';
    if (lane === laneCount - 1) return 'end';
    return 'middle';
  };
  const labelX = (lane: number) => {
    if (laneCount <= 1) return SVG_W / 2;
    if (lane === 0) return 1.2;
    if (lane === laneCount - 1) return SVG_W - 1.2;
    return laneX(lane);
  };
  const rowY = (row: number) =>
    SVG_TOP + (row / Math.max(1, LADDER_ROW_COUNT - 1)) * (SVG_BOTTOM - SVG_TOP);

  const updateParticipant = (index: number, value: string) => {
    if (mode !== 'multiplayer' || !props.isHost || mpPhase !== 'draw') return;
    const next = participantIds.map((p, i) => (i === index ? value : p));
    setParticipantIds(next);
    props.onAction({ type: 'update_ladder_config', participantIds: next }).catch(console.error);
  };

  const updateDestination = (index: number, value: string) => {
    if (mode === 'multiplayer' && !props.isHost) return;
    setDestinations((prev) => prev.map((d, i) => (i === index ? value : d)));
    if (mode !== 'multiplayer' || !props.isHost || mpPhase !== 'config') return;
    if (hostDestinationsTimerRef.current) {
      clearTimeout(hostDestinationsTimerRef.current);
    }
    hostDestinationsTimerRef.current = setTimeout(() => {
      props
        .onAction({
          type: 'update_ladder_config',
          destinations: normalizeLadderDestinationsLength(
            destinationsRef.current.map((d) => d.trim()),
            participantIds.length,
          ),
        })
        .catch(console.error);
      hostDestinationsTimerRef.current = null;
    }, HOST_DESTINATIONS_SAVE_DEBOUNCE_MS);
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
    if (hostDestinationsTimerRef.current) {
      clearTimeout(hostDestinationsTimerRef.current);
      hostDestinationsTimerRef.current = null;
    }
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
    if (mode !== 'multiplayer' || mpPhase !== 'draw' || userHasDrawn) return;
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
      {isTripleLane && (
        <div className="grid" style={{ gap: '1.5cqmin' }}>
          <div className="font-semibold text-[#334155]" style={{ fontSize: '4.5cqmin' }}>
            {t.ladder_pick_lane}
          </div>
          <div className="flex flex-wrap" style={{ gap: '1.5cqmin' }}>
            {Array.from({ length: laneCount }, (_, lane) => {
              const occupantId = getOccupantAtLane(lane, participantIds, startLanes);
              const isMine = occupantId === userId;
              const isTakenByOther = Boolean(occupantId && occupantId !== userId);
              const canPick = participantIds.includes(userId);
              const occupantLabel = occupantId
                ? getMemberNickname(members, occupantId, userId, t.ladder_you)
                : t.ladder_lane_empty;
              return (
                <button
                  key={`lane-${lane}`}
                  type="button"
                  onClick={() => selectStartLane(lane)}
                  disabled={!canPick || mp.actionLoading || isTakenByOther}
                  className={`min-w-[22cqmin] rounded-xl border px-3 py-2 text-left transition-colors ${
                    isMine
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                      : occupantId
                        ? 'border-slate-200 bg-slate-50 text-slate-600'
                        : 'border-dashed border-slate-300 bg-white text-slate-700 hover:border-indigo-300'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
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
            {destinations.map((value, index) => (
                <input
                  key={`d-${index}`}
                  value={value}
                  onChange={(e) => updateDestination(index, e.target.value)}
                  placeholder={t.ladder_destination_ph}
                  disabled={!mp.isHost}
                  readOnly={!mp.isHost}
                  className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-[#1e293b] outline-none focus:border-indigo-400 disabled:opacity-60 read-only:cursor-default read-only:bg-slate-50/80"
                  style={{ fontSize: '4.5cqmin' }}
                />
              ))}
          </div>
        </div>
      </div>

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
      animatePaths?: boolean;
      occupiedRungs?: LadderRung[];
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
            x={labelX(lane)}
            y={LABEL_TOP_Y}
            textAnchor={labelAnchor(lane)}
            dominantBaseline="middle"
            className="fill-slate-800 font-semibold"
            style={{ fontSize: topLabelFontSize }}
          >
            {label}
          </text>
        ))}
        {destinations.map((label, lane) => (
          <text
            key={`bottom-${lane}`}
            x={labelX(lane)}
            y={LABEL_BOTTOM_Y}
            textAnchor={labelAnchor(lane)}
            dominantBaseline="middle"
            className="fill-slate-700"
            style={{ fontSize: bottomLabelFontSize }}
          >
            {label}
          </text>
        ))}
        {Array.from({ length: laneCount }).map((_, lane) => {
          const x = laneX(lane);
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
            />
          );
        })}
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
              <DescendingLadderPath
                key={`path-${participantId}`}
                d={pointsToSvgPath(pathPoints)}
                color={color}
                animate={Boolean(options.animatePaths)}
              />
            );
          })}
        {options.interactive &&
          Array.from({ length: LADDER_ROW_COUNT }).map((_, row) =>
            Array.from({ length: laneCount - 1 }).map((_, leftLane) => {
              const occupied = options.occupiedRungs ?? rungs;
              const taken = occupied.some((r) => r.leftLane === leftLane && r.row === row);
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
    const celebrationKey = `${mpSession?.id ?? ''}:${mpConfig?.revealStartedAt ?? 'done'}`;
    const showCelebration = showPaths && celebrationDismissedKey !== celebrationKey;
    return (
      <div className="grid" style={{ gap: '2cqmin' }}>
        <GameResultCelebration
          open={showCelebration}
          celebrationKey={celebrationKey}
          title={t.games_congrats_title}
          message={t.ladder_result_announce}
          dismissLabel={t.games_congrats_dismiss}
          onDismiss={() => setCelebrationDismissedKey(celebrationKey)}
        />
        <p className="font-semibold text-[#1e293b]" style={{ fontSize: '4.5cqmin' }}>
          {t.ladder_result_title}
        </p>
        {renderLadderSvg(rungsToShow, {
          interactive: false,
          showResultPaths: showPaths,
          animatePaths: isLiveReveal && showPaths,
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

      {renderLadderSvg(baseRungs.length > 0 ? baseRungs : userRungs, {
        interactive: participantIds.includes(userId),
        showResultPaths: false,
        occupiedRungs: [...baseRungs, ...userRungs],
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
            disabled={props.actionLoading}
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
