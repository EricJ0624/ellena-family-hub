'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  games_waiting_host: string;
  games_cancel: string;
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

const SVG_TOP = 10;
const SVG_BOTTOM = 90;

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
  const [destinations, setDestinations] = useState<string[]>(
    mpConfig?.destinations ?? ['', ''],
  );
  const [displayRungs, setDisplayRungs] = useState<LadderRung[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showPaths, setShowPaths] = useState(false);

  useEffect(() => {
    if (!mpConfig) return;
    setParticipantIds(mpConfig.participantIds);
    setDestinations(mpConfig.destinations);
  }, [mpConfig?.participantIds.join('|'), mpConfig?.destinations.join('|')]);

  const userRungs = mpConfig?.userRungs ?? [];
  const finalRungs = mpConfig?.finalRungs ?? [];
  const mpPhase =
    mpSession?.status === 'config'
      ? 'config'
      : mpSession?.status === 'active'
        ? 'draw'
        : mpSession?.status === 'revealing' || mpSession?.status === 'completed'
          ? 'result'
          : 'config';

  useEffect(() => {
    if (!isMultiplayer || mpPhase !== 'result' || finalRungs.length === 0) return;
    const userDrawn = userRungs;
    const autoRungs = finalRungs.filter((r) => !r.drawnBy);
    setIsRevealing(true);
    setShowPaths(false);
    setDisplayRungs([...userDrawn]);
    let index = 0;
    const timer = window.setInterval(() => {
      if (index >= autoRungs.length) {
        window.clearInterval(timer);
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
    }, 35);
    return () => window.clearInterval(timer);
  }, [isMultiplayer, mpPhase, mpSession?.status, finalRungs.length, mpConfig?.revealStartedAt]);

  const laneCount = participantIds.length;

  const participantsReady = useMemo(() => {
    const idsOk =
      participantIds.every((id) => id.trim()) &&
      new Set(participantIds).size === participantIds.length;
    return idsOk && laneCount >= LADDER_MIN_LANES && members.length > 0;
  }, [participantIds, laneCount, members.length]);

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
    return participantIds.map((fromId, startLane) => {
      const endLane = traceLadderPath(startLane, finalRungs, LADDER_ROW_COUNT);
      const from = getMemberNickname(members, fromId, userId, t.ladder_you);
      const to = destinations[endLane] ?? '';
      return { from, to, startLane, endLane };
    });
  }, [mpPhase, participantIds, destinations, finalRungs, members, userId, t.ladder_you]);

  const svgWidth = 100;
  const laneX = (lane: number) => (lane / Math.max(1, laneCount - 1)) * svgWidth;
  const rowY = (row: number) => 12 + (row / Math.max(1, LADDER_ROW_COUNT - 1)) * 68;

  const updateParticipant = (index: number, value: string) => {
    if (mode !== 'multiplayer' || !props.isHost) return;
    if (mpPhase !== 'config' && mpPhase !== 'draw') return;
    const next = participantIds.map((p, i) => (i === index ? value : p));
    setParticipantIds(next);
    props.onAction({ type: 'update_ladder_config', participantIds: next }).catch(console.error);
  };

  const updateDestination = (index: number, value: string) => {
    setDestinations((prev) => prev.map((d, i) => (i === index ? value : d)));
    if (mode === 'multiplayer') {
      if (props.isHost) {
        const next = destinations.map((d, i) => (i === index ? value : d));
        props.onAction({ type: 'update_ladder_config', destinations: next }).catch(console.error);
      } else if (myParticipant?.slot_index === index) {
        props.onAction({ type: 'update_own_destination', destination: value }).catch(console.error);
      }
    }
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
    props.onAction({ type: 'host_begin_draw' }).catch(console.error);
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
                disabled={!mp.isHost}
              />
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
                mp.isHost || myParticipant?.slot_index === index;
              return (
                <input
                  key={`d-${index}`}
                  value={value}
                  onChange={(e) => updateDestination(index, e.target.value)}
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

      {!participantsReady && (
        <p className="text-[#64748b]" style={{ fontSize: '4cqmin' }}>
          {t.ladder_min_players}
        </p>
      )}

      {mp.isHost ? (
        <button
          type="button"
          onClick={beginDrawPhase}
          disabled={!participantsReady || mp.actionLoading}
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
    options: { interactive: boolean; showResultPaths: boolean },
  ) => (
    <div className="glass-panel-soft overflow-x-auto rounded-xl" style={{ padding: '2cqmin' }}>
      <svg
        viewBox={`0 0 ${svgWidth} 100`}
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
        <div className="games-field-list grid">
          {participantIds.slice(0, LADDER_MIN_LANES).map((value, index) => (
            <MemberSelect
              key={`p-${index}`}
              members={members}
              value={value}
              onChange={(next) =>
                setParticipantIds((prev) => prev.map((p, i) => (i === index ? next : p)))
              }
              placeholder={t.select_member}
              currentUserId={userId}
              youLabel={t.ladder_you}
              excludeUserIds={participantIds.filter((_, i) => i !== index)}
            />
          ))}
        </div>
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
    const rungsToShow = displayRungs.length > 0 ? displayRungs : finalRungs;
    return (
      <div className="grid" style={{ gap: '2cqmin' }}>
        <p className="font-semibold text-[#1e293b]" style={{ fontSize: '4.5cqmin' }}>
          {t.ladder_result_title}
        </p>
        {renderLadderSvg(rungsToShow, { interactive: false, showResultPaths: showPaths })}
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
