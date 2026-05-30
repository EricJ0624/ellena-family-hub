'use client';

import React, { useMemo, useState } from 'react';
import type { FamilyTaskMemberOption } from '@/app/features/family-tasks/types';
import { pickRouletteIndex } from '../types';

type RouletteTranslations = {
  roulette_slots: string;
  roulette_slot_ph: string;
  roulette_add_slot: string;
  roulette_remove_slot: string;
  roulette_fill_members: string;
  roulette_min_slots: string;
  roulette_spin: string;
  roulette_spinning: string;
  roulette_reset: string;
  roulette_result: string;
};

interface RouletteGameTabProps {
  members: FamilyTaskMemberOption[];
  translations: RouletteTranslations;
  formatText: (template: string, vars: Record<string, string>) => string;
}

const WHEEL_COLORS = [
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#22c55e',
  '#0ea5e9',
];

export function RouletteGameTab({ members, translations: t, formatText }: RouletteGameTabProps) {
  const [slots, setSlots] = useState<string[]>(['', '']);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  const validSlots = useMemo(
    () => slots.map((s) => s.trim()).filter(Boolean),
    [slots],
  );

  const sliceAngle = validSlots.length > 0 ? 360 / validSlots.length : 360;

  const spin = () => {
    if (validSlots.length < 2 || spinning) return;
    setWinner(null);
    setSpinning(true);
    const extraTurns = 5 + Math.floor(Math.random() * 4);
    const randomOffset = Math.random() * 360;
    const nextRotation = rotation + extraTurns * 360 + randomOffset;
    setRotation(nextRotation);
    window.setTimeout(() => {
      const index = pickRouletteIndex(validSlots.length, nextRotation);
      setWinner(validSlots[index] ?? null);
      setSpinning(false);
    }, 3200);
  };

  const fillMembers = () => {
    if (members.length === 0) return;
    setSlots(members.map((m) => m.nickname));
    setWinner(null);
    setRotation(0);
  };

  const addSlot = () => setSlots((prev) => [...prev, '']);
  const removeSlot = () => {
    if (slots.length <= 2) return;
    setSlots((prev) => prev.slice(0, -1));
  };

  const reset = () => {
    setSlots(['', '']);
    setRotation(0);
    setWinner(null);
    setSpinning(false);
  };

  return (
    <div className="grid" style={{ gap: '2.5cqmin' }}>
      <div>
        <div className="mb-2 font-semibold text-[#334155]" style={{ fontSize: '4.5cqmin' }}>
          {t.roulette_slots}
        </div>
        <div className="grid" style={{ gap: '1.5cqmin' }}>
          {slots.map((value, index) => (
            <input
              key={`slot-${index}`}
              value={value}
              onChange={(e) =>
                setSlots((prev) => prev.map((s, i) => (i === index ? e.target.value : s)))
              }
              placeholder={t.roulette_slot_ph}
              className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-[#1e293b] outline-none focus:border-indigo-400"
              style={{ fontSize: '4.5cqmin' }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap" style={{ gap: '1.5cqmin' }}>
        <button
          type="button"
          onClick={addSlot}
          className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white"
          style={{ fontSize: '4cqmin' }}
        >
          {t.roulette_add_slot}
        </button>
        <button
          type="button"
          onClick={removeSlot}
          disabled={slots.length <= 2}
          className="rounded-lg bg-slate-200 px-3 py-2 font-semibold text-slate-700 disabled:opacity-50"
          style={{ fontSize: '4cqmin' }}
        >
          {t.roulette_remove_slot}
        </button>
        <button
          type="button"
          onClick={fillMembers}
          disabled={members.length === 0}
          className="rounded-lg bg-violet-600 px-3 py-2 font-semibold text-white disabled:opacity-50"
          style={{ fontSize: '4cqmin' }}
        >
          {t.roulette_fill_members}
        </button>
      </div>

      <div className="relative mx-auto flex items-center justify-center" style={{ width: 'min(100%, 55cqmin)', aspectRatio: '1' }}>
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
            {validSlots.length > 0 ? (
              validSlots.map((label, index) => {
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
                const color = WHEEL_COLORS[index % WHEEL_COLORS.length];
                return (
                  <g key={`slice-${index}`}>
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
                      style={{ fontSize: 5, fontWeight: 700 }}
                      transform={`rotate(${midAngle}, ${tx}, ${ty})`}
                    >
                      {label.slice(0, 8)}
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

      {validSlots.length < 2 && (
        <p className="text-center text-[#64748b]" style={{ fontSize: '4cqmin' }}>
          {t.roulette_min_slots}
        </p>
      )}

      {winner && (
        <p className="text-center font-bold text-emerald-700" style={{ fontSize: '5cqmin' }}>
          {formatText(t.roulette_result, { name: winner })}
        </p>
      )}

      <div className="flex flex-wrap justify-center" style={{ gap: '1.5cqmin' }}>
        <button
          type="button"
          onClick={spin}
          disabled={validSlots.length < 2 || spinning}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
          style={{ fontSize: '4.5cqmin' }}
        >
          {spinning ? t.roulette_spinning : t.roulette_spin}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-slate-200 px-4 py-2 font-semibold text-slate-700"
          style={{ fontSize: '4.5cqmin' }}
        >
          {t.roulette_reset}
        </button>
      </div>
    </div>
  );
}
