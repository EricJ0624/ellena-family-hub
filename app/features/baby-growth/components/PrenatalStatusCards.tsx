'use client';

import React from 'react';
import type { PrenatalLog, PrenatalLogType } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import { formatTimeAgo } from '../utils/age-calculator';

interface PrenatalStatusCardsProps {
  /** PrenatalQuickLogModal(태아크기)와 동일 주수 전달용 */
  weeksPregnant: number;
  logs: PrenatalLog[];
  t: BabyGrowthTranslations;
  onCardClick: (logType: PrenatalLogType) => void;
  fillHeight?: boolean;
}

function latestOf(logs: PrenatalLog[], type: PrenatalLogType): PrenatalLog | null {
  return logs.find((l) => l.log_type === type) ?? null;
}

export function PrenatalStatusCards({
  weeksPregnant: _weeksPregnant,
  logs,
  t,
  onCardClick,
  fillHeight = false,
}: PrenatalStatusCardsProps) {
  const weight = latestOf(logs, 'maternal_weight');
  const bp = latestOf(logs, 'blood_pressure');
  const checkup = latestOf(logs, 'checkup_note');
  const kicks = latestOf(logs, 'fetal_movement');
  const lab = latestOf(logs, 'lab_result') ?? latestOf(logs, 'medication');

  const checkupValue = checkup
    ? [
        checkup.checkup_at ?? formatTimeAgo(checkup.logged_at, t),
        checkup.hospital_name,
        checkup.next_checkup_at ? `${t.prenatal_next_checkup} ${checkup.next_checkup_at}` : null,
        checkup.fetal_weight_est_g != null ? `${checkup.fetal_weight_est_g}g` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  const cards: Array<{
    key: PrenatalLogType;
    emoji: string;
    label: string;
    value: string | null;
  }> = [
    {
      key: 'checkup_note',
      emoji: '🏥',
      label: t.prenatal_card_checkup,
      value: checkupValue,
    },
    {
      key: 'maternal_weight',
      emoji: '⚖️',
      label: t.prenatal_card_maternal,
      value: weight?.weight_kg != null
        ? `${weight.weight_kg}kg · ${formatTimeAgo(weight.logged_at, t)}`
        : bp && bp.systolic != null
          ? `${bp.systolic}/${bp.diastolic} · ${formatTimeAgo(bp.logged_at, t)}`
          : null,
    },
    {
      key: 'fetal_movement',
      emoji: '🦶',
      label: t.prenatal_card_kicks,
      value: kicks?.kick_count != null
        ? `${kicks.kick_count}${kicks.kick_duration_min != null ? ` / ${kicks.kick_duration_min}min` : ''} · ${formatTimeAgo(kicks.logged_at, t)}`
        : kicks
          ? formatTimeAgo(kicks.logged_at, t)
          : null,
    },
    {
      key: 'lab_result',
      emoji: '🧪',
      label: t.prenatal_card_lab,
      value: lab
        ? [
            lab.lab_name || lab.medication_name,
            lab.lab_result_text || lab.notes,
            formatTimeAgo(lab.logged_at, t),
          ]
            .filter(Boolean)
            .join(' · ')
        : null,
    },
  ];

  return (
    <div className={`relative w-full overflow-visible ${fillHeight ? 'h-full min-h-0' : ''}`}>
      <div
        className={
          fillHeight
            ? 'relative z-[1] grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-1.5'
            : 'relative z-[1] grid grid-cols-2 gap-2'
        }
      >
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => onCardClick(card.key)}
            className={
              fillHeight
                ? 'group relative min-h-0 cursor-pointer overflow-visible rounded-2xl border border-white/90 bg-white/70 p-2 text-left shadow-sm'
                : 'group relative min-h-[6.5rem] cursor-pointer overflow-visible rounded-2xl border border-white/90 bg-white/70 p-2.5 text-left shadow-sm'
            }
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base leading-none">{card.emoji}</span>
              <span className="truncate text-xs font-medium text-gray-500">{card.label}</span>
            </div>
            <p
              className={`mt-1 line-clamp-3 text-xs font-semibold leading-normal ${
                card.value ? 'text-gray-800' : 'text-gray-400'
              }`}
            >
              {card.value ?? t.no_record}
            </p>
            <span className="mt-0.5 inline-block text-[10px] font-medium text-pink-400">
              {t.record_now} +
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
