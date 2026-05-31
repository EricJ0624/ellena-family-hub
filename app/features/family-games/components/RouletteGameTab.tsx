'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { FamilyTaskMemberOption } from '@/app/features/family-tasks/types';
import { asRouletteConfig } from '@/lib/family-games/session-types';
import type { FamilyGameSessionBundle, GameSessionAction } from '@/lib/family-games/session-types';
import {
  buildRouletteSegments,
  getRouletteSlotsPerMemberOptions,
  type RouletteLaunchConfig,
} from '../types';
import { getMemberNickname } from './MemberSelect';
import { areParticipantSlotsReady, ParticipantSetupPicker } from './ParticipantSetupPicker';

type RouletteTranslations = {
  roulette_participants: string;
  roulette_slots_per_member: string;
  roulette_slots_per_member_option: string;
  roulette_total_slots: string;
  roulette_select_participants: string;
  roulette_min_participants: string;
  roulette_spin: string;
  roulette_spinning: string;
  roulette_reset: string;
  roulette_result: string;
  roulette_confirm_join: string;
  roulette_waiting_ready: string;
  rps_you_submitted: string;
  no_members: string;
  select_member: string;
  ladder_you: string;
  games_waiting_host: string;
  games_cancel: string;
  games_add_member: string;
  games_remove_member: string;
};

type RouletteGameTabBaseProps = {
  userId: string;
  members: FamilyTaskMemberOption[];
  translations: RouletteTranslations;
  formatText: (template: string, vars: Record<string, string>) => string;
};

type RouletteGameTabSetupProps = RouletteGameTabBaseProps & {
  mode: 'setup';
  launchLabel: string;
  onLaunch: (config: RouletteLaunchConfig) => void | Promise<void>;
  disabled?: boolean;
};

type RouletteGameTabMultiplayerProps = RouletteGameTabBaseProps & {
  mode: 'multiplayer';
  sessionBundle: FamilyGameSessionBundle;
  isHost: boolean;
  onAction: (action: GameSessionAction) => Promise<unknown>;
  actionLoading?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
};

export type RouletteGameTabProps = RouletteGameTabSetupProps | RouletteGameTabMultiplayerProps;

const MEMBER_COLORS = [
  '#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6',
  '#ef4444', '#22c55e', '#0ea5e9', '#f97316', '#06b6d4',
  '#a855f7', '#84cc16', '#e11d48', '#0d9488', '#7c3aed',
];

export function RouletteGameTab(props: RouletteGameTabProps) {
  const { userId, members, translations: t, formatText, mode } = props;
  const isSetup = mode === 'setup';
  const isMultiplayer = mode === 'multiplayer';

  const mpConfig = isMultiplayer ? asRouletteConfig(props.sessionBundle.session.config) : null;
  const mpSession = isMultiplayer ? props.sessionBundle.session : null;
  const mpParticipants = isMultiplayer ? props.sessionBundle.participants : [];
  const myParticipant = mpParticipants.find((p) => p.user_id === userId) ?? null;

  const [setupSelectedIds, setSetupSelectedIds] = useState<string[]>(['', '']);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  const selectedIds = mpConfig?.selectedIds ?? [];
  const slotsPerMember = mpConfig?.slotsPerMember ?? 1;
  const isConfigPhase = mpSession?.status === 'config';
  const canSpin = mpSession?.status === 'active' || mpSession?.status === 'completed';

  const slotsPerMemberOptions = useMemo(
    () => getRouletteSlotsPerMemberOptions(selectedIds.length),
    [selectedIds.length],
  );

  const getLabel = (memberUserId: string) =>
    getMemberNickname(members, memberUserId, userId, t.ladder_you);

  const wheelSegments = useMemo(() => {
    if (selectedIds.length < 2) return [];
    return buildRouletteSegments(selectedIds, slotsPerMember, getLabel);
  }, [selectedIds, slotsPerMember, members, userId, t.ladder_you]);

  const totalSlots = wheelSegments.length;

  useEffect(() => {
    if (!mpConfig?.spinStartedAt || mpConfig.rotation === undefined) return;
    setSpinning(true);
    setWinner(null);
    setRotation(mpConfig.rotation);
    const timeout = window.setTimeout(() => {
      const winnerName = mpConfig.winnerUserId
        ? getMemberNickname(members, mpConfig.winnerUserId, userId, t.ladder_you)
        : mpConfig.winnerLabel ?? null;
      setWinner(winnerName);
      setSpinning(false);
    }, 3200);
    return () => window.clearTimeout(timeout);
  }, [mpConfig?.spinStartedAt, mpConfig?.rotation, mpConfig?.winnerUserId, members, userId, t.ladder_you]);

  const toggleReady = () => {
    if (!isMultiplayer || !myParticipant) return;
    props.onAction({ type: 'toggle_roulette_ready' }).catch(console.error);
  };

  const updateSlotsPerMember = (value: number) => {
    if (!isMultiplayer || !props.isHost) return;
    props
      .onAction({ type: 'host_update_roulette_config', slotsPerMember: value })
      .catch(console.error);
  };

  const spin = () => {
    if (!isMultiplayer || !props.isHost || spinning) return;
    props.onAction({ type: 'host_spin_roulette' }).catch(console.error);
  };

  const mainPlayersReady = areParticipantSlotsReady(setupSelectedIds) && members.length >= 2;

  const readyCount = mpParticipants.filter((p) => p.ready && selectedIds.includes(p.user_id)).length;

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
        <ParticipantSetupPicker
          members={members}
          userId={userId}
          slotIds={setupSelectedIds}
          onSlotIdsChange={setSetupSelectedIds}
          maxSlots={members.length}
          selectPlaceholder={t.select_member}
          youLabel={t.ladder_you}
          addLabel={t.games_add_member}
          removeLabel={t.games_remove_member}
        />
        <button
          type="button"
          onClick={() =>
            props.onLaunch({
              selectedIds: [...setupSelectedIds],
              slotsPerMember: 1,
            })
          }
          disabled={!mainPlayersReady || props.disabled}
          className="games-setup-actions w-full flex-shrink-0 rounded-lg bg-emerald-600 px-3 py-2.5 font-semibold text-white disabled:opacity-50"
          style={{ fontSize: '4.5cqmin' }}
        >
          {props.launchLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: '2.5cqmin' }}>
      {isConfigPhase && (
        <>
          <div>
            <div
              className="mb-2 font-semibold text-[#334155]"
              style={{ fontSize: '4.5cqmin' }}
            >
              {t.roulette_participants}
            </div>
            <div className="flex flex-wrap" style={{ gap: '1cqmin' }}>
              {selectedIds.map((memberUserId) => (
                <span
                  key={memberUserId}
                  className="rounded-full bg-indigo-600 px-2.5 py-1.5 font-medium text-white"
                  style={{ fontSize: '3.5cqmin' }}
                >
                  {getLabel(memberUserId)}
                </span>
              ))}
            </div>
          </div>

          {props.isHost && selectedIds.length >= 2 && slotsPerMemberOptions.length > 0 && (
            <div className="grid sm:grid-cols-2" style={{ gap: '2cqmin' }}>
              <div>
                <label
                  className="mb-2 block font-semibold text-[#334155]"
                  style={{ fontSize: '4.5cqmin' }}
                  htmlFor="roulette-slots-per-member"
                >
                  {t.roulette_slots_per_member}
                </label>
                <select
                  id="roulette-slots-per-member"
                  value={slotsPerMember}
                  disabled={spinning || props.actionLoading}
                  onChange={(e) => updateSlotsPerMember(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-[#1e293b] outline-none focus:border-indigo-400 disabled:opacity-60"
                  style={{ fontSize: '4.5cqmin' }}
                >
                  {slotsPerMemberOptions.map((each) => (
                    <option key={each} value={each}>
                      {formatText(t.roulette_slots_per_member_option, {
                        each: String(each),
                        total: String(each * selectedIds.length),
                      })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <p className="font-medium text-indigo-700" style={{ fontSize: '4.5cqmin' }}>
                  {formatText(t.roulette_total_slots, {
                    total: String(slotsPerMember * selectedIds.length),
                    count: String(selectedIds.length),
                  })}
                </p>
              </div>
            </div>
          )}

          {myParticipant && selectedIds.includes(userId) && (
            <button
              type="button"
              onClick={toggleReady}
              disabled={props.actionLoading}
              className={`rounded-lg px-4 py-2 font-semibold ${
                myParticipant.ready
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-indigo-600 text-white'
              }`}
              style={{ fontSize: '4.5cqmin' }}
            >
              {myParticipant.ready ? t.rps_you_submitted : t.roulette_confirm_join}
            </button>
          )}

          <p className="text-[#64748b]" style={{ fontSize: '4cqmin' }}>
            {formatText(t.roulette_waiting_ready, {
              done: String(readyCount),
              total: String(selectedIds.length),
            })}
          </p>

          {!props.isHost && (
            <p className="text-[#64748b]" style={{ fontSize: '4cqmin' }}>
              {t.games_waiting_host}
            </p>
          )}
        </>
      )}

      <div
        className="relative mx-auto flex items-center justify-center"
        style={{ width: 'min(100%, 55cqmin)', aspectRatio: '1' }}
      >
        <div
          className="absolute top-0 z-10 -translate-y-1/2"
          style={{
            width: 0,
            height: 0,
            borderLeft: '1.2cqmin solid transparent',
            borderRight: '1.2cqmin solid transparent',
            borderTop: '2.5cqmin solid #ef4444',
          }}
        />
        <div
          className="relative h-full w-full rounded-full border-4 border-white/80 shadow-lg"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 3.2s cubic-bezier(0.15, 0.85, 0.2, 1)' : 'none',
          }}
        >
          <svg viewBox="0 0 100 100" className="h-full w-full">
            {wheelSegments.length > 0 ? (
              wheelSegments.map((segment, index) => {
                const sliceAngle = 360 / totalSlots;
                const start = index * sliceAngle;
                const end = start + sliceAngle;
                const largeArc = sliceAngle > 180 ? 1 : 0;
                const startRad = ((start - 90) * Math.PI) / 180;
                const endRad = ((end - 90) * Math.PI) / 180;
                const x1 = 50 + 50 * Math.cos(startRad);
                const y1 = 50 + 50 * Math.sin(startRad);
                const x2 = 50 + 50 * Math.cos(endRad);
                const y2 = 50 + 50 * Math.sin(endRad);
                const midAngle = start + sliceAngle / 2;
                const midRad = ((midAngle - 90) * Math.PI) / 180;
                const tx = 50 + 32 * Math.cos(midRad);
                const ty = 50 + 32 * Math.sin(midRad);
                const color = MEMBER_COLORS[segment.memberIndex % MEMBER_COLORS.length];
                const fontSize = totalSlots > 10 ? 3.5 : 5;
                return (
                  <g key={`slice-${segment.userId}-${index}`}>
                    <path
                      d={`M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`}
                      fill={color}
                      stroke="#fff"
                      strokeWidth={0.5}
                    />
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#fff"
                      style={{ fontSize, fontWeight: 700 }}
                      transform={`rotate(${midAngle}, ${tx}, ${ty})`}
                    >
                      {segment.label.slice(0, totalSlots > 12 ? 4 : 8)}
                    </text>
                  </g>
                );
              })
            ) : (
              <circle cx="50" cy="50" r="48" fill="#e2e8f0" />
            )}
          </svg>
        </div>
      </div>

      {winner && (
        <p className="text-center font-bold text-emerald-700" style={{ fontSize: '5cqmin' }}>
          {formatText(t.roulette_result, { name: winner })}
        </p>
      )}

      {canSpin && props.isHost && (
        <div className="flex flex-wrap justify-center" style={{ gap: '1.5cqmin' }}>
          <button
            type="button"
            onClick={spin}
            disabled={totalSlots < 2 || spinning || props.actionLoading}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
            style={{ fontSize: '4.5cqmin' }}
          >
            {spinning ? t.roulette_spinning : t.roulette_spin}
          </button>
        </div>
      )}

      {props.onCancel && isConfigPhase && (
        <button
          type="button"
          onClick={props.onCancel}
          className="rounded-lg bg-slate-200 px-4 py-2 font-semibold text-slate-700"
          style={{ fontSize: '4.5cqmin' }}
        >
          {props.cancelLabel ?? t.games_cancel}
        </button>
      )}
    </div>
  );
}
