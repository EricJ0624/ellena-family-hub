'use client';

import React from 'react';
import { calcAgeInDays, calcAgeInMonths, calcAgeInWeeks } from '../utils/age-calculator';
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

  const genderEmoji =
    profile.gender === 'male' ? '👦' : profile.gender === 'female' ? '👧' : '🍼';

  return (
    <div className="relative z-20 flex w-full items-center gap-3">
      {/* 아바타 */}
      <div className="relative shrink-0">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.name}
            className="w-12 h-12 rounded-full object-cover border-2 border-pink-200"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-2xl">
            {genderEmoji}
          </div>
        )}
      </div>

      {/* 이름 + 월령 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="truncate rounded bg-[#fff8f4] font-bold text-base text-gray-900">{profile.name}</span>
          <span className="text-xs bg-pink-100 text-pink-500 px-2 py-0.5 rounded-full font-medium shrink-0">
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

      {/* D-Day 뱃지 */}
      <div className="shrink-0 pl-2 text-right">
        <span className="rounded bg-[#fff8f4] text-lg font-black leading-none text-pink-400">{dday}</span>
        {onEditClick && (
          <button
            onClick={onEditClick}
            className="block text-xs text-pink-400 hover:text-pink-600 mt-0.5 transition-colors"
            aria-label={t.edit_baby}
          >
            ✏️
          </button>
        )}
      </div>
    </div>
  );
}
