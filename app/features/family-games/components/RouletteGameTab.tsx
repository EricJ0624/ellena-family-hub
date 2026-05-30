'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { FamilyTaskMemberOption } from '@/app/features/family-tasks/types';
import {
  buildRouletteSegments,
  getRouletteSlotsPerMemberOptions,
  pickRouletteIndex,
} from '../types';
import { getMemberNickname } from './MemberSelect';

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
  no_members: string;
  ladder_you: string;
};

interface RouletteGameTabProps {
  userId: string;
  members: FamilyTaskMemberOption[];
  translations: RouletteTranslations;
  formatText: (template: string, vars: Record<string, string>) => string;
}

const MEMBER_COLORS = [
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#22c55e',
  '#0ea5e9',
  '#f97316',
  '#06b6d4',
  '#a855f7',
  '#84cc16',
  '#e11d48',
  '#0d9488',
  '#7c3aed',
];

export function RouletteGameTab({
  userId,
  members,
  translations: t,
  formatText,
}: RouletteGameTabProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [slotsPerMember, setSlotsPerMember] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  const slotsPerMemberOptions = useMemo(
    () => getRouletteSlotsPerMemberOptions(selectedIds.length),
    [selectedIds.length],
  );

  useEffect(() => {
    if (slotsPerMemberOptions.length === 0) return;
    if (!slotsPerMemberOptions.includes(slotsPerMember)) {
      setSlotsPerMember(slotsPerMemberOptions[0]);
    }
  }, [slotsPerMemberOptions, slotsPerMember]);

  const getLabel = (memberUserId: string) =>
    getMemberNickname(members, memberUserId, userId, t.ladder_you);

  const wheelSegments = useMemo(() => {
    if (selectedIds.length < 2) return [];
    return buildRouletteSegments(selectedIds, slotsPerMember, getLabel);
  }, [selectedIds, slotsPerMember, members, userId, t.ladder_you]);

  const totalSlots = wheelSegments.length;
  const sliceAngle = totalSlots > 0 ? 360 / totalSlots : 360;
  const canSpin = selectedIds.length >= 2 && totalSlots >= 2;

  const toggleParticipant = (memberUserId: string) => {
    if (spinning) return;
    setWinner(null);
    setSelectedIds((prev) =>
      prev.includes(memberUserId)
        ? prev.filter((id) => id !== memberUserId)
        : [...prev, memberUserId],
    );
  };

  const selectAllMembers = () => {
    if (spinning) return;
    setWinner(null);
    setSelectedIds(members.map((m) => m.userId));
  };

  const spin = () => {
    if (!canSpin || spinning) return;
    setWinner(null);
    setSpinning(true);
    const extraTurns = 5 + Math.floor(Math.random() * 4);
    const randomOffset = Math.random() * 360;
    const nextRotation = rotation + extraTurns * 360 + randomOffset;
    setRotation(nextRotation);
    window.setTimeout(() => {
      const index = pickRouletteIndex(totalSlots, nextRotation);
      setWinner(wheelSegments[index]?.label ?? null);
      setSpinning(false);
    }, 3200);
  };

  const reset = () => {
    setSelectedIds([]);
    setSlotsPerMember(1);
    setRotation(0);
    setWinner(null);
    setSpinning(false);
  };

  if (members.length === 0) {
    return (
      <p className="text-[#64748b]" style={{ fontSize: '4.5cqmin' }}>
        {t.no_members}
      </p>
    );
  }

  return (
    <div className="grid" style={{ gap: '2.5cqmin' }}>
      <div>
        <div
          className="mb-2 flex flex-wrap items-center justify-between gap-2 font-semibold text-[#334155]"
          style={{ fontSize: '4.5cqmin' }}
        >
          <span>{t.roulette_participants}</span>
          <button
            type="button"
            onClick={selectAllMembers}
            disabled={spinning || selectedIds.length === members.length}
            className="rounded-lg bg-violet-100 px-2.5 py-1 font-semibold text-violet-800 disabled:opacity-50"
            style={{ fontSize: '3.5cqmin' }}
          >
            ALL
          </button>
        </div>
        <div className="flex flex-wrap" style={{ gap: '1cqmin' }}>
          {members.map((m) => {
            const selected = selectedIds.includes(m.userId);
            const name = getLabel(m.userId);
            return (
              <button
                key={m.userId}
                type="button"
                disabled={spinning}
                onClick={() => toggleParticipant(m.userId)}
                className={`rounded-full px-2.5 py-1.5 font-medium transition-colors disabled:opacity-60 ${
                  selected
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                style={{ fontSize: '3.5cqmin' }}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      {selectedIds.length >= 2 && slotsPerMemberOptions.length > 0 && (
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
              disabled={spinning}
              onChange={(e) => {
                setWinner(null);
                setSlotsPerMember(Number(e.target.value));
              }}
              className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-[#1e293b] outline-none focus:border-indigo-400 disabled:opacity-60"
              style={{ fontSize: '4.5cqmin' }}
            >
              {slotsPerMemberOptions.map((each) => {
                const total = each * selectedIds.length;
                return (
                  <option key={each} value={each}>
                    {formatText(t.roulette_slots_per_member_option, {
                      each: String(each),
                      total: String(total),
                    })}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="flex items-end">
            <p className="font-medium text-indigo-700" style={{ fontSize: '4.5cqmin' }}>
              {formatText(t.roulette_total_slots, {
                total: String(totalSlots),
                count: String(selectedIds.length),
              })}
            </p>
          </div>
        </div>
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

      {selectedIds.length < 2 && (
        <p className="text-center text-[#64748b]" style={{ fontSize: '4cqmin' }}>
          {selectedIds.length === 0 ? t.roulette_select_participants : t.roulette_min_participants}
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
          disabled={!canSpin || spinning}
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
