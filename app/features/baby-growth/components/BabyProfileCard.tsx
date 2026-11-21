'use client';

import React from 'react';
import {
  calcAgeInDays,
  calcAgeInMonths,
  calcAgeInWeeks,
  getBabyFaceEmoji,
} from '../utils/age-calculator';
import { formatBirthTime } from '../utils/birth-snapshot';
import {
  displayBabyName,
  gestationalProgress,
  isPrenatal,
} from '../utils/prenatal';
import type { BabyProfile } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';

interface BabyProfileCardProps {
  profile: BabyProfile;
  t: BabyGrowthTranslations;
  onEditClick?: () => void;
  onReportClick?: () => void;
  onBirthClick?: () => void;
}

export function BabyProfileCard({
  profile,
  t,
  onEditClick,
  onReportClick,
  onBirthClick,
}: BabyProfileCardProps) {
  const prenatal = isPrenatal(profile);
  const shownName = displayBabyName(profile);

  if (prenatal) {
    const due = profile.due_date;
    const progress = due ? gestationalProgress(due) : null;
    return (
      <div className="relative z-20 flex w-full items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pink-100 text-2xl"
          role="img"
          aria-label={shownName}
        >
          🤰
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate rounded bg-[#fff8f4] text-base font-bold text-gray-900">
              {shownName}
            </span>
            {progress ? (
              <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-pink-100 px-2 text-xs font-medium leading-none text-pink-500">
                {t.prenatal_weeks.replace('{n}', String(progress.weeksPregnant))}
              </span>
            ) : null}
          </div>
          {due ? (
            <p className="mt-0.5 w-fit rounded bg-[#fff8f4] text-xs text-gray-400">
              {t.due_date}: {due}
              {progress ? ` · ${t.prenatal_until_due.replace('{dday}', progress.ddayLabel)}` : ''}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-gray-400">{t.due_date_missing}</p>
          )}
          {(onReportClick || onBirthClick) ? (
            <div className="mt-1 flex max-w-full flex-wrap items-center gap-1.5">
              {onReportClick ? (
                <button
                  type="button"
                  onClick={onReportClick}
                  className="inline-flex max-w-full items-center rounded-full bg-pink-500 px-2.5 py-1 text-[11px] font-semibold leading-none text-white"
                >
                  <span className="truncate">{t.prenatal_widget_title}</span>
                </button>
              ) : null}
              {onBirthClick ? (
                <button
                  type="button"
                  onClick={onBirthClick}
                  className="inline-flex max-w-full items-center rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-semibold leading-none text-white"
                >
                  <span className="truncate">{t.birth_transition_cta}</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="shrink-0 pl-2 text-right">
          {progress ? (
            <span className="text-lg font-black leading-none text-pink-400">{progress.ddayLabel}</span>
          ) : null}
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

  const birthDate = profile.birth_date!;
  const days = calcAgeInDays(birthDate);
  const months = calcAgeInMonths(birthDate);
  const weeks = calcAgeInWeeks(birthDate);
  const dday = t.dday_label.replace('{n}', String(days));
  const ageLabel =
    months < 2
      ? t.age_weeks.replace('{n}', String(weeks))
      : t.age_months.replace('{n}', String(months));
  const faceEmoji = getBabyFaceEmoji(profile.gender, months);
  const birthTime = formatBirthTime(profile.birth_time);
  const birthLine = birthTime ? `${birthDate} (${birthTime})` : birthDate;

  return (
    <div className="relative z-20 flex w-full items-center gap-3">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pink-100 text-2xl"
        role="img"
        aria-label={shownName}
      >
        {faceEmoji}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate rounded bg-[#fff8f4] text-base font-bold text-gray-900">{shownName}</span>
          <span className="inline-flex h-5 shrink-0 items-center gap-0">
            <span className="inline-flex h-full items-center rounded-full bg-pink-100 px-2 text-xs font-medium leading-none text-pink-500">
              {ageLabel}
            </span>
            {profile.blood_type ? (
              <span className="-ml-0.5 inline-flex h-full items-center rounded-full bg-rose-50 px-2 text-xs font-medium leading-none text-rose-500">
                {profile.blood_type}
              </span>
            ) : null}
          </span>
        </div>
        <p className="mt-0.5 w-fit rounded bg-[#fff8f4] text-xs text-gray-400">{birthLine}</p>
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
