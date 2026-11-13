'use client';

import React from 'react';
import { calcAgeInDays, calcAgeInMonths, calcAgeInWeeks } from '../utils/age-calculator';
import type { BabyProfile } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';

interface BabyProfileCardProps {
  profile: BabyProfile;
  t: BabyGrowthTranslations;
  onEditClick?: () => void;
}

export function BabyProfileCard({ profile, t, onEditClick }: BabyProfileCardProps) {
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
    <div className="flex items-center gap-3 w-full">
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
          <span className="font-bold text-base truncate">{profile.name}</span>
          <span className="text-xs bg-pink-50 text-pink-500 px-2 py-0.5 rounded-full font-medium shrink-0">
            {ageLabel}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{profile.birth_date}</p>
      </div>

      {/* D-Day 뱃지 */}
      <div className="shrink-0 text-right">
        <span className="text-lg font-black text-pink-400 leading-none">{dday}</span>
        {onEditClick && (
          <button
            onClick={onEditClick}
            className="block text-xs text-gray-400 hover:text-gray-600 mt-0.5 transition-colors"
            aria-label={t.edit_baby}
          >
            ✏️
          </button>
        )}
      </div>
    </div>
  );
}
