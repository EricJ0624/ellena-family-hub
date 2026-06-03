'use client';

import React from 'react';
import type { FamilyTaskMemberOption } from '@/app/features/family-tasks/types';
import type { FamilyGameSessionBundle } from '@/lib/family-games/session-types';
import {
  canAddLobbySlot,
  canRemoveLobbySlot,
  getLobbyMaxSlotsCap,
  getSessionMaxSlots,
  lobbyCanStart,
} from '@/lib/family-games/lobby-helpers';
import type { GameTab } from '../types';
import { getMemberNickname } from './MemberSelect';

export type GameLobbyTranslations = {
  ladder_participants: string;
  ladder_you: string;
  games_join: string;
  games_create_game: string;
  games_leave: string;
  games_launch: string;
  games_waiting_host: string;
  games_add_member: string;
  games_remove_member: string;
  games_lobby_status_joined: string;
  games_lobby_status_not_joined: string;
  games_lobby_slots: string;
  games_lobby_you_host: string;
  games_cancel: string;
  no_members: string;
};

export interface GameLobbyPanelProps {
  gameType: GameTab;
  userId: string;
  members: FamilyTaskMemberOption[];
  bundle: FamilyGameSessionBundle | null;
  isHost: boolean;
  isParticipant: boolean;
  actionLoading: boolean;
  onJoin: () => Promise<void>;
  onLeave: () => Promise<void>;
  onAddSlot: () => Promise<void>;
  onRemoveSlot: () => Promise<void>;
  onStart: () => Promise<void>;
  onCancel?: () => Promise<void>;
  translations: GameLobbyTranslations;
  formatText: (template: string, vars: Record<string, string>) => string;
}

export function GameLobbyPanel({
  gameType,
  userId,
  members,
  bundle,
  isHost,
  isParticipant,
  actionLoading,
  onJoin,
  onLeave,
  onAddSlot,
  onRemoveSlot,
  onStart,
  onCancel,
  translations: t,
  formatText,
}: GameLobbyPanelProps) {
  if (members.length === 0) {
    return (
      <p className="text-[#64748b]" style={{ fontSize: '4.5cqw' }}>
        {t.no_members}
      </p>
    );
  }

  const maxCap = getLobbyMaxSlotsCap(gameType, members.length);
  const maxSlots = bundle ? getSessionMaxSlots(bundle.session) : 2;
  const participants = bundle
    ? [...bundle.participants].sort((a, b) => a.slot_index - b.slot_index)
    : [];
  const joinedCount = participants.length;
  const canStart = Boolean(bundle && lobbyCanStart(joinedCount, maxSlots) && isHost);
  const showSlotControls =
    Boolean(bundle) && isHost && gameType !== 'rps' && bundle?.session.phase === 'lobby';
  const canAdd = showSlotControls && canAddLobbySlot(maxSlots, maxCap, gameType);
  const canRemove =
    showSlotControls && canRemoveLobbySlot(maxSlots, joinedCount, gameType);

  const labelFor = (memberUserId: string) =>
    getMemberNickname(members, memberUserId, userId, t.ladder_you);

  return (
    <div className="games-tab-panel games-tab-lobby">
      <div className="games-lobby-body">
        <div
          className="flex flex-wrap items-center justify-between rounded-xl bg-slate-50/90 px-3 py-2"
          style={{ gap: '1cqw' }}
        >
          <div>
            <p className="font-medium text-[#334155]" style={{ fontSize: '4cqw' }}>
              {isParticipant ? t.games_lobby_status_joined : t.games_lobby_status_not_joined}
            </p>
            {isParticipant && isHost && (
              <p className="text-indigo-700" style={{ fontSize: '3.5cqw' }}>
                {t.games_lobby_you_host}
              </p>
            )}
          </div>
          {!isParticipant ? (
            <button
              type="button"
              onClick={() => onJoin().catch(console.error)}
              disabled={actionLoading}
              className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white disabled:opacity-50"
              style={{ fontSize: '4cqw' }}
            >
              {bundle ? t.games_join : t.games_create_game}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onLeave().catch(console.error)}
              disabled={actionLoading}
              className="rounded-lg bg-slate-200 px-3 py-2 font-semibold text-slate-700 disabled:opacity-50"
              style={{ fontSize: '4cqw' }}
            >
              {t.games_leave}
            </button>
          )}
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between" style={{ gap: '1cqw' }}>
            <span className="font-semibold text-[#334155]" style={{ fontSize: '4.5cqw' }}>
              {t.ladder_participants}
            </span>
            <span className="font-medium text-[#64748b]" style={{ fontSize: '3.5cqw' }}>
              {formatText(t.games_lobby_slots, {
                joined: String(joinedCount),
                max: String(maxSlots),
              })}
            </span>
          </div>
          <ul className="m-0 list-none p-0" style={{ display: 'grid', gap: '1cqw' }}>
            {participants.length === 0 ? (
              <li
                className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-[#94a3b8]"
                style={{ fontSize: '4cqw' }}
              >
                —
              </li>
            ) : (
              participants.map((p) => (
                <li
                  key={p.user_id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white/80 px-3 py-2"
                >
                  <span className="font-medium text-[#1e293b]" style={{ fontSize: '4cqw' }}>
                    {labelFor(p.user_id)}
                  </span>
                  {bundle?.session.host_user_id === p.user_id && (
                    <span
                      className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-700"
                      style={{ fontSize: '3cqw' }}
                    >
                      Host
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>
          {showSlotControls && (
            <div className="mt-2 flex flex-wrap" style={{ gap: '1cqw' }}>
              <button
                type="button"
                onClick={() => onAddSlot().catch(console.error)}
                disabled={!canAdd || actionLoading}
                className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white disabled:opacity-50"
                style={{ fontSize: '4cqw' }}
              >
                {t.games_add_member}
              </button>
              {canRemove && (
                <button
                  type="button"
                  onClick={() => onRemoveSlot().catch(console.error)}
                  disabled={actionLoading}
                  className="rounded-lg bg-slate-200 px-3 py-2 font-semibold text-slate-700 disabled:opacity-50"
                  style={{ fontSize: '4cqw' }}
                >
                  {t.games_remove_member}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid flex-shrink-0" style={{ gap: '1.5cqw' }}>
        {isHost ? (
          <button
            type="button"
            onClick={() => onStart().catch(console.error)}
            disabled={!canStart || actionLoading}
            className="games-setup-actions w-full rounded-lg bg-emerald-600 px-3 py-2.5 font-semibold text-white disabled:opacity-50"
            style={{ fontSize: '4.5cqw' }}
          >
            {t.games_launch}
          </button>
        ) : (
          bundle &&
          isParticipant && (
            <p className="text-center text-[#64748b]" style={{ fontSize: '4cqw' }}>
              {t.games_waiting_host}
            </p>
          )
        )}
        {isHost && onCancel && (
          <button
            type="button"
            onClick={() => onCancel().catch(console.error)}
            disabled={actionLoading}
            className="w-full rounded-lg bg-slate-200 px-3 py-2 font-semibold text-slate-700 disabled:opacity-50"
            style={{ fontSize: '4cqw' }}
          >
            {t.games_cancel}
          </button>
        )}
      </div>
    </div>
  );
}
