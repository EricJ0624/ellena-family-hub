'use client';

import React from 'react';
import {
  calcAgeInDays,
  calcAgeInMonths,
  calcAgeInWeeks,
  getBabyFaceEmoji,
} from '../utils/age-calculator';
import type { BabyProfile } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';

interface BabyProfileCardProps {
  profile: BabyProfile;
  t: BabyGrowthTranslations;
  onEditClick?: () => void;
  onReportClick?: () => void;
}

export function BabyProfileCard({ profile, t, onEditClick, onReportClick }: BabyProfileCardProps) {
  const days = calcAgeInDays(profile.birth_date);
  const months = calcAgeInMonths(profile.birth_date);
  const weeks = calcAgeInWeeks(profile.birth_date);

  const dday = t.dday_label.replace('{n}', String(days));
  const ageLabel =
    months < 2
      ? t.age_weeks.replace('{n}', String(weeks))
      : t.age_months.replace('{n}', String(months));

  const faceEmoji = getBabyFaceEmoji(profile.gender, months);

  return (
    <div className="relative z-20 flex w-full items-center gap-3">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pink-100 text-2xl"
        role="img"
        aria-label={profile.name}
      >
        {faceEmoji}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate rounded bg-[#fff8f4] text-base font-bold text-gray-900">{profile.name}</span>
          <span className="shrink-0 rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-500">
            {ageLabel}
          </span>
        </div>
        <p className="mt-0.5 w-fit rounded bg-[#fff8f4] text-xs text-gray-400">{profile.birth_date}</p>
        {onReportClick && (
          <button
            type="button"
            onClick={onReportClick}
            className="mt-1 inline-flex max-w-full items-center rounded-full bg-pink-500 px-2.5 py-1 text-[11px] font-semibold leading-none text-white"
          >
            <span className="truncate">{t.widget_title}</span>
          </button>
        )}
      </div>

      <div className="shrink-0 pl-2 text-right">
        <span className="text-lg font-black leading-none text-pink-400">{dday}</span>
        {onEditClick && (
          <button
            onClick={onEditClick}
            className="mt-0.5 block text-xs text-pink-400 transition-colors hover:text-pink-600"
            aria-label={t.edit_baby}
          >
            ✏️
          </button>
        )}
      </div>
    </div>
  );
}
