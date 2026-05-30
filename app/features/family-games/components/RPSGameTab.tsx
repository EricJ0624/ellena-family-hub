'use client';

import React, { useEffect, useState } from 'react';
import { resolveRPS, type RPSChoice } from '../types';

type RPSTranslations = {
  rps_player1: string;
  rps_player2: string;
  rps_rock: string;
  rps_paper: string;
  rps_scissors: string;
  rps_reveal: string;
  rps_reset: string;
  rps_pick_both: string;
  rps_animating: string;
  rps_result_win: string;
  rps_result_draw: string;
};

interface RPSGameTabProps {
  translations: RPSTranslations;
  formatText: (template: string, vars: Record<string, string>) => string;
}

const CHOICES: RPSChoice[] = ['rock', 'paper', 'scissors'];

const CHOICE_EMOJI: Record<RPSChoice, string> = {
  rock: '✊',
  paper: '✋',
  scissors: '✌️',
};

export function RPSGameTab({ translations: t, formatText }: RPSGameTabProps) {
  const [p1Choice, setP1Choice] = useState<RPSChoice | null>(null);
  const [p2Choice, setP2Choice] = useState<RPSChoice | null>(null);
  const [animating, setAnimating] = useState(false);
  const [displayP1, setDisplayP1] = useState<RPSChoice>('rock');
  const [displayP2, setDisplayP2] = useState<RPSChoice>('rock');
  const [revealed, setRevealed] = useState(false);
  const [resultText, setResultText] = useState<string | null>(null);

  useEffect(() => {
    if (!animating || !p1Choice || !p2Choice) return undefined;
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
            winner: outcome === 'p1' ? t.rps_player1 : t.rps_player2,
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
  }, [animating, p1Choice, p2Choice, t, formatText]);

  const reveal = () => {
    if (!p1Choice || !p2Choice || animating) return;
    setRevealed(false);
    setResultText(null);
    setAnimating(true);
  };

  const reset = () => {
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
  ) => (
    <div className="grid grid-cols-3" style={{ gap: '1.5cqmin' }}>
      {CHOICES.map((choice) => (
        <button
          key={`${player}-${choice}`}
          type="button"
          disabled={animating || revealed}
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

  return (
    <div className="grid" style={{ gap: '2.5cqmin' }}>
      <div className="grid sm:grid-cols-2" style={{ gap: '2.5cqmin' }}>
        <div className="glass-panel-soft rounded-xl" style={{ padding: '2.5cqmin' }}>
          <div className="mb-2 font-semibold text-[#334155]" style={{ fontSize: '4.5cqmin' }}>
            {t.rps_player1}
          </div>
          {renderChoiceButtons('p1', p1Choice, setP1Choice)}
        </div>
        <div className="glass-panel-soft rounded-xl" style={{ padding: '2.5cqmin' }}>
          <div className="mb-2 font-semibold text-[#334155]" style={{ fontSize: '4.5cqmin' }}>
            {t.rps_player2}
          </div>
          {renderChoiceButtons('p2', p2Choice, setP2Choice)}
        </div>
      </div>

      {(animating || revealed) && (
        <div className="flex items-center justify-center rounded-xl bg-slate-900/5" style={{ gap: '4cqmin', padding: '3cqmin' }}>
          <div className="text-center">
            <div style={{ fontSize: '12cqmin' }}>{CHOICE_EMOJI[displayP1]}</div>
            <div className="text-[#64748b]" style={{ fontSize: '3.5cqmin' }}>{t.rps_player1}</div>
          </div>
          <div className="font-bold text-[#94a3b8]" style={{ fontSize: '6cqmin' }}>VS</div>
          <div className="text-center">
            <div style={{ fontSize: '12cqmin' }}>{CHOICE_EMOJI[displayP2]}</div>
            <div className="text-[#64748b]" style={{ fontSize: '3.5cqmin' }}>{t.rps_player2}</div>
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
          disabled={!p1Choice || !p2Choice || animating}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
          style={{ fontSize: '4.5cqmin' }}
        >
          {t.rps_reveal}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-slate-200 px-4 py-2 font-semibold text-slate-700"
          style={{ fontSize: '4.5cqmin' }}
        >
          {t.rps_reset}
        </button>
      </div>

      {!p1Choice || !p2Choice ? (
        <p className="text-center text-[#64748b]" style={{ fontSize: '4cqmin' }}>
          {t.rps_pick_both}
        </p>
      ) : null}
    </div>
  );
}
