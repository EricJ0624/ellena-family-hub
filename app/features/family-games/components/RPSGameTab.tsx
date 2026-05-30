'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { FamilyTaskMemberOption } from '@/app/features/family-tasks/types';
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
  select_member: string;
  no_members: string;
  duplicate_member: string;
  ladder_you: string;
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
  onLaunch: (config: RPSLaunchConfig) => void;
  launchConfig?: never;
};

type RPSGameTabPlayProps = RPSGameTabBaseProps & {
  mode: 'play';
  launchConfig: RPSLaunchConfig;
  launchLabel?: never;
  onLaunch?: never;
};

export type RPSGameTabProps = RPSGameTabSetupProps | RPSGameTabPlayProps;

const CHOICES: RPSChoice[] = ['rock', 'paper', 'scissors'];

const CHOICE_EMOJI: Record<RPSChoice, string> = {
  rock: '✊',
  paper: '✋',
  scissors: '✌️',
};

export function RPSGameTab(props: RPSGameTabProps) {
  const { userId, members, translations: t, formatText, mode } = props;
  const isSetup = mode === 'setup';

  const [p1UserId, setP1UserId] = useState(isSetup ? '' : props.launchConfig.p1UserId);
  const [p2UserId, setP2UserId] = useState(isSetup ? '' : props.launchConfig.p2UserId);
  const [p1Choice, setP1Choice] = useState<RPSChoice | null>(null);
  const [p2Choice, setP2Choice] = useState<RPSChoice | null>(null);
  const [animating, setAnimating] = useState(false);
  const [displayP1, setDisplayP1] = useState<RPSChoice>('rock');
  const [displayP2, setDisplayP2] = useState<RPSChoice>('rock');
  const [revealed, setRevealed] = useState(false);
  const [resultText, setResultText] = useState<string | null>(null);

  const p1Name = useMemo(
    () => getMemberNickname(members, p1UserId, userId, t.ladder_you),
    [members, p1UserId, userId, t.ladder_you],
  );
  const p2Name = useMemo(
    () => getMemberNickname(members, p2UserId, userId, t.ladder_you),
    [members, p2UserId, userId, t.ladder_you],
  );

  const playersReady = Boolean(p1UserId && p2UserId && p1UserId !== p2UserId);
  const choicesReady = Boolean(p1Choice && p2Choice);

  useEffect(() => {
    if (isSetup || !animating || !p1Choice || !p2Choice) return undefined;
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
  }, [animating, p1Choice, p2Choice, t, formatText, p1Name, p2Name, isSetup]);

  const reveal = () => {
    if (isSetup || !playersReady || !choicesReady || animating) return;
    setRevealed(false);
    setResultText(null);
    setAnimating(true);
  };

  const resetPlay = () => {
    setP1Choice(null);
    setP2Choice(null);
    setAnimating(false);
    setRevealed(false);
    setResultText(null);
    setDisplayP1('rock');
    setDisplayP2('rock');
  };

  const choiceLabel = (choice: RPSChoice) => {
    if (choice === 'rock') return t.rps_rock;
    if (choice === 'paper') return t.rps_paper;
    return t.rps_scissors;
  };

  const renderChoiceButtons = (
    player: 'p1' | 'p2',
    selected: RPSChoice | null,
    onSelect: (c: RPSChoice) => void,
    disabled: boolean,
  ) => (
    <div className="grid grid-cols-3" style={{ gap: '1.5cqmin' }}>
      {CHOICES.map((choice) => (
        <button
          key={`${player}-${choice}`}
          type="button"
          disabled={disabled || animating || revealed}
          onClick={() => onSelect(choice)}
          className={`rounded-xl border-2 px-2 py-3 font-semibold transition-colors disabled:opacity-60 ${
            selected === choice
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-white/80 text-slate-700 hover:border-indigo-300'
          }`}
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
      <div className="grid" style={{ gap: '2.5cqmin' }}>
        <div className="grid sm:grid-cols-2" style={{ gap: '2.5cqmin' }}>
          <div className="glass-panel-soft rounded-xl" style={{ padding: '2.5cqmin' }}>
            <div className="mb-2 font-semibold text-[#334155]" style={{ fontSize: '4.5cqmin' }}>
              {t.rps_player1}
            </div>
            <MemberSelect
              members={members}
              value={p1UserId}
              onChange={setP1UserId}
              placeholder={t.select_member}
              currentUserId={userId}
              youLabel={t.ladder_you}
              excludeUserIds={[p2UserId]}
            />
          </div>
          <div className="glass-panel-soft rounded-xl" style={{ padding: '2.5cqmin' }}>
            <div className="mb-2 font-semibold text-[#334155]" style={{ fontSize: '4.5cqmin' }}>
              {t.rps_player2}
            </div>
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
        </div>

        {p1UserId && p2UserId && p1UserId === p2UserId && (
          <p className="text-center text-[#b91c1c]" style={{ fontSize: '4cqmin' }}>
            {t.duplicate_member}
          </p>
        )}

        {!playersReady ? (
          <p className="text-center text-[#64748b]" style={{ fontSize: '4cqmin' }}>
            {t.rps_select_members}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => props.onLaunch({ p1UserId, p2UserId })}
            className="w-full rounded-lg bg-emerald-600 px-3 py-2.5 font-semibold text-white"
            style={{ fontSize: '4.5cqmin' }}
          >
            {props.launchLabel}
          </button>
        )}
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
          {renderChoiceButtons('p1', p1Choice, setP1Choice, false)}
        </div>
        <div className="glass-panel-soft rounded-xl" style={{ padding: '2.5cqmin' }}>
          <div className="mb-2 font-semibold text-[#334155]" style={{ fontSize: '4.5cqmin' }}>
            {p2Name || t.rps_player2}
          </div>
          {renderChoiceButtons('p2', p2Choice, setP2Choice, false)}
        </div>
      </div>

      {(animating || revealed) && (
        <div className="flex items-center justify-center rounded-xl bg-slate-900/5" style={{ gap: '4cqmin', padding: '3cqmin' }}>
          <div className="text-center">
            <div style={{ fontSize: '12cqmin' }}>{CHOICE_EMOJI[displayP1]}</div>
            <div className="text-[#64748b]" style={{ fontSize: '3.5cqmin' }}>{p1Name}</div>
          </div>
          <div className="font-bold text-[#94a3b8]" style={{ fontSize: '6cqmin' }}>VS</div>
          <div className="text-center">
            <div style={{ fontSize: '12cqmin' }}>{CHOICE_EMOJI[displayP2]}</div>
            <div className="text-[#64748b]" style={{ fontSize: '3.5cqmin' }}>{p2Name}</div>
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

      <div className="flex flex-wrap justify-center" style={{ gap: '1.5cqmin' }}>
        <button
          type="button"
          onClick={reveal}
          disabled={!choicesReady || animating}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
          style={{ fontSize: '4.5cqmin' }}
        >
          {t.rps_reveal}
        </button>
        <button
          type="button"
          onClick={resetPlay}
          className="rounded-lg bg-slate-200 px-4 py-2 font-semibold text-slate-700"
          style={{ fontSize: '4.5cqmin' }}
        >
          {t.rps_reset}
        </button>
      </div>

      {!choicesReady && (
        <p className="text-center text-[#64748b]" style={{ fontSize: '4cqmin' }}>
          {t.rps_pick_choices}
        </p>
      )}
    </div>
  );
}
