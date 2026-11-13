'use client';

import React from 'react';
import type { BabyReminder } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';

interface ReminderBannerProps {
  reminders: BabyReminder[];
  t: BabyGrowthTranslations;
  onDismiss: (id: string) => void;
  onNavigate?: (reminderType: string) => void;
}

const REMINDER_EMOJI: Record<string, string> = {
  growth_record: '📏',
  checkup: '🏥',
  vaccination: '💉',
};

export function ReminderBanner({ reminders, t, onDismiss, onNavigate }: ReminderBannerProps) {
  if (reminders.length === 0) return null;

  const next = reminders[0];
  const daysUntil = Math.round((new Date(next.remind_at).getTime() - Date.now()) / 86_400_000);
  const isPast = daysUntil < 0;
  const isToday = daysUntil === 0;

  const dDayLabel = isPast
    ? `D+${Math.abs(daysUntil)}`
    : isToday
    ? 'D-Day'
    : `D-${daysUntil}`;

  const bgColor = isPast
    ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'
    : isToday
    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800'
    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800';

  const textColor = isPast
    ? 'text-red-600 dark:text-red-400'
    : isToday
    ? 'text-orange-600 dark:text-orange-400'
    : 'text-blue-600 dark:text-blue-400';

  const reminderText = getReminderText(next, t);

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${bgColor} mb-3`}>
      <span className="text-lg">{REMINDER_EMOJI[next.reminder_type] ?? '🔔'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{reminderText}</p>
        <p className={`text-[11px] font-bold ${textColor}`}>{dDayLabel}</p>
      </div>
      {onNavigate && (
        <button
          onClick={() => onNavigate(next.reminder_type)}
          className={`text-xs font-semibold ${textColor} hover:underline whitespace-nowrap`}
        >
          바로가기
        </button>
      )}
      <button
        onClick={() => onDismiss(next.id)}
        className="text-gray-300 hover:text-gray-500 text-lg leading-none ml-1"
        aria-label="알림 닫기"
      >
        ×
      </button>
    </div>
  );
}

function getReminderText(reminder: BabyReminder, t: BabyGrowthTranslations): string {
  switch (reminder.reminder_type) {
    case 'growth_record':
      return t.reminder_growth_due;
    case 'checkup': {
      const label = reminder.reference_key ? ` (${reminder.reference_key})` : '';
      return `${t.reminder_checkup_due}${label}`;
    }
    case 'vaccination': {
      const vaccine = reminder.reference_key ? ` (${reminder.reference_key})` : '';
      return `예방접종 예정${vaccine}`;
    }
    default:
      return '알림';
  }
}
