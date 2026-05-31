'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { FamilyTaskMemberOption } from '@/app/features/family-tasks/types';
import { asRPSConfig } from '@/lib/family-games/session-types';
import type { FamilyGameSessionBundle, GameSessionAction } from '@/lib/family-games/session-types';
import { resolveRPS, type RPSChoice, type RPSLaunchConfig } from '../types';
import { getMemberNickname, MemberSelect } from './MemberSelect';

type RPSTranslations = {
  rps_player1: string;
  rps_player2: string;
  rps_rock: string;
  rps_paper: string;
  rps_scissors: string;
  rps_reveal: string;
  rps_reset: string;
  rps_select_members: string;
  rps_pick_choices: string;
  rps_pick_both: string;
  rps_animating: string;
  rps_result_win: string;
  rps_result_draw: string;
  rps_waiting_opponent: string;
  rps_you_submitted: string;
  select_member: string;
  no_members: string;
  duplicate_member: string;
  ladder_you: string;
  games_cancel: string;
};

type RPSGameTabBaseProps = {
  userId: string;
  members: FamilyTaskMemberOption[];
  translations: RPSTranslations;
  formatText: (template: string, vars: Record<string, string>) => string;
};

type RPSGameTabSetupProps = RPSGameTabBaseProps & {
  mode: 'setup';
  launchLabel: string;
  onLaunch: (config: RPSLaunchConfig) => void | Promise<void>;
  disabled?: boolean;
};

type RPSGameTabMultiplayerProps = RPSGameTabBaseProps & {
  mode: 'multiplayer';
  sessionBundle: FamilyGameSessionBundle;
  isHost: boolean;
  onAction: (action: GameSessionAction) => Promise<unknown>;
  actionLoading?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
};

export type RPSGameTabProps = RPSGameTabSetupProps | RPSGameTabMultiplayerProps;

const CHOICES: RPSChoice[] = ['rock', 'paper', 'scissors'];

const CHOICE_EMOJI: Record<RPSChoice, string> = {
  rock: '✊',
  paper: '✋',
  scissors: '✌️',
};

export function RPSGameTab(props: RPSGameTabProps) {
  const { userId, members, translations: t, formatText, mode } = props;
  const isSetup = mode === 'setup';
  const isMultiplayer = mode === 'multiplayer';

  const mpConfig = isMultiplayer ? asRPSConfig(props.sessionBundle.session.config) : null;
  const mpSession = isMultiplayer ? props.sessionBundle.session : null;
  const mpParticipants = isMultiplayer ? props.sessionBundle.participants : [];

  const [p1UserId, setP1UserId] = useState('');
  const [p2UserId, setP2UserId] = useState('');
  const [animating, setAnimating] = useState(false);
  const [displayP1, setDisplayP1] = useState<RPSChoice>('rock');
  const [displayP2, setDisplayP2] = useState<RPSChoice>('rock');
  const [revealed, setRevealed] = useState(false);
  const [resultText, setResultText] = useState<string | null>(null);
  const [localSubmitted, setLocalSubmitted] = useState(false);

  const activeP1 = mpConfig?.p1UserId ?? p1UserId;
  const activeP2 = mpConfig?.p2UserId ?? p2UserId;
  const isPlayer = userId === activeP1 || userId === activeP2;
  const myReady = mpParticipants.find((p) => p.user_id === userId)?.ready ?? false;

  const p1Name = useMemo(
    () => getMemberNickname(members, activeP1, userId, t.ladder_you),
    [members, activeP1, userId, t.ladder_you],
  );
  const p2Name = useMemo(
    () => getMemberNickname(members, activeP2, userId, t.ladder_you),
    [members, activeP2, userId, t.ladder_you],
  );

  const playersReady = Boolean(activeP1 && activeP2 && activeP1 !== activeP2);
  const p1Choice = mpConfig?.p1Choice ?? null;
  const p2Choice = mpConfig?.p2Choice ?? null;
  const isRevealPhase =
    mpSession?.status === 'revealing' || mpSession?.status === 'completed';

  useEffect(() => {
    if (!isMultiplayer || !isRevealPhase || !p1Choice || !p2Choice) return;
    setAnimating(true);
    setRevealed(false);
    setResultText(null);
    let tick = 0;
    const interval = window.setInterval(() => {
      const random = CHOICES[Math.floor(Math.random() * CHOICES.length)];
      setDisplayP1(random);
      setDisplayP2(CHOICES[(tick + 1) % CHOICES.length]);
      tick += 1;
    }, 90);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setDisplayP1(p1Choice);
      setDisplayP2(p2Choice);
      const outcome = resolveRPS(p1Choice, p2Choice);
      if (outcome === 'draw') {
        setResultText(t.rps_result_draw);
      } else {
        setResultText(
          formatText(t.rps_result_win, {
            winner: outcome === 'p1' ? p1Name : p2Name,
          }),
        );
      }
      setAnimating(false);
      setRevealed(true);
    }, 1400);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [isMultiplayer, isRevealPhase, p1Choice, p2Choice, mpConfig?.revealStartedAt, t, formatText, p1Name, p2Name]);

  const submitChoice = async (choice: RPSChoice) => {
    if (!isMultiplayer || !isPlayer || myReady || localSubmitted) return;
    setLocalSubmitted(true);
    await props.onAction({ type: 'submit_rps', choice });
  };

  const choiceLabel = (choice: RPSChoice) => {
    if (choice === 'rock') return t.rps_rock;
    if (choice === 'paper') return t.rps_paper;
    return t.rps_scissors;
  };

  const renderChoiceButtons = (disabled: boolean) => (
    <div className="grid grid-cols-3" style={{ gap: '1.5cqmin' }}>
      {CHOICES.map((choice) => (
        <button
          key={choice}
          type="button"
          disabled={disabled || animating || revealed || (isMultiplayer && props.actionLoading)}
          onClick={() => submitChoice(choice)}
          className="rounded-xl border-2 border-slate-200 bg-white/80 px-2 py-3 font-semibold text-slate-700 transition-colors hover:border-indigo-300 disabled:opacity-60"
          style={{ fontSize: '4cqmin' }}
        >
          <div style={{ fontSize: '8cqmin', lineHeight: 1 }}>{CHOICE_EMOJI[choice]}</div>
          {choiceLabel(choice)}
        </button>
      ))}
    </div>
  );

  if (members.length < 2) {
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
          <MemberSelect
            members={members}
            value={p1UserId}
            onChange={setP1UserId}
            placeholder={t.select_member}
            currentUserId={userId}
            youLabel={t.ladder_you}
            excludeUserIds={[p2UserId]}
          />
          <MemberSelect
            members={members}
            value={p2UserId}
            onChange={setP2UserId}
            placeholder={t.select_member}
            currentUserId={userId}
            youLabel={t.ladder_you}
            excludeUserIds={[p1UserId]}
          />
        </div>
        <button
          type="button"
          onClick={() => props.onLaunch({ p1UserId, p2UserId })}
          disabled={!playersReady || props.disabled}
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
      <div className="grid sm:grid-cols-2" style={{ gap: '2.5cqmin' }}>
        <div className="glass-panel-soft rounded-xl" style={{ padding: '2.5cqmin' }}>
          <div className="mb-2 font-semibold text-[#334155]" style={{ fontSize: '4.5cqmin' }}>
            {p1Name || t.rps_player1}
          </div>
          {userId === activeP1 && !isRevealPhase ? (
            renderChoiceButtons(myReady || localSubmitted)
          ) : (
            <p className="text-[#64748b]" style={{ fontSize: '4cqmin' }}>
              {mpParticipants.find((p) => p.user_id === activeP1)?.ready
                ? t.rps_you_submitted
                : t.rps_waiting_opponent}
            </p>
          )}
        </div>
        <div className="glass-panel-soft rounded-xl" style={{ padding: '2.5cqmin' }}>
          <div className="mb-2 font-semibold text-[#334155]" style={{ fontSize: '4.5cqmin' }}>
            {p2Name || t.rps_player2}
          </div>
          {userId === activeP2 && !isRevealPhase ? (
            renderChoiceButtons(myReady || localSubmitted)
          ) : (
            <p className="text-[#64748b]" style={{ fontSize: '4cqmin' }}>
              {mpParticipants.find((p) => p.user_id === activeP2)?.ready
                ? t.rps_you_submitted
                : t.rps_waiting_opponent}
            </p>
          )}
        </div>
      </div>

      {(animating || revealed) && (
        <div
          className="flex items-center justify-center rounded-xl bg-slate-900/5"
          style={{ gap: '4cqmin', padding: '3cqmin' }}
        >
          <div className="text-center">
            <div style={{ fontSize: '12cqmin' }}>{CHOICE_EMOJI[displayP1]}</div>
            <div className="text-[#64748b]" style={{ fontSize: '3.5cqmin' }}>
              {p1Name}
            </div>
          </div>
          <div className="font-bold text-[#94a3b8]" style={{ fontSize: '6cqmin' }}>
            VS
          </div>
          <div className="text-center">
            <div style={{ fontSize: '12cqmin' }}>{CHOICE_EMOJI[displayP2]}</div>
            <div className="text-[#64748b]" style={{ fontSize: '3.5cqmin' }}>
              {p2Name}
            </div>
          </div>
        </div>
      )}

      {animating && (
        <p className="text-center font-medium text-indigo-600" style={{ fontSize: '4.5cqmin' }}>
          {t.rps_animating}
        </p>
      )}

      {resultText && (
        <p className="text-center font-bold text-emerald-700" style={{ fontSize: '5cqmin' }}>
          {resultText}
        </p>
      )}

      {!isPlayer && !isRevealPhase && (
        <p className="text-center text-[#64748b]" style={{ fontSize: '4cqmin' }}>
          {t.rps_pick_both}
        </p>
      )}

      {props.onCancel && (
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
