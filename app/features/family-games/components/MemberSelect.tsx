'use client';

import React from 'react';
import type { FamilyTaskMemberOption } from '@/app/features/family-tasks/types';

interface MemberSelectProps {
  members: FamilyTaskMemberOption[];
  value: string;
  onChange: (userId: string) => void;
  placeholder: string;
  currentUserId?: string;
  youLabel?: string;
  disabled?: boolean;
  excludeUserIds?: string[];
  id?: string;
}

export function getMemberNickname(
  members: FamilyTaskMemberOption[],
  userId: string,
  currentUserId?: string,
  youLabel?: string,
): string {
  if (!userId) return '';
  const found = members.find((m) => m.userId === userId);
  if (!found) return userId;
  if (currentUserId && found.userId === currentUserId && youLabel) return youLabel;
  return found.nickname;
}

export function MemberSelect({
  members,
  value,
  onChange,
  placeholder,
  currentUserId,
  youLabel,
  disabled,
  excludeUserIds = [],
  id,
}: MemberSelectProps) {
  const excluded = new Set(excludeUserIds.filter(Boolean));

  return (
    <select
      id={id}
      value={value}
      disabled={disabled || members.length === 0}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-[#1e293b] outline-none focus:border-indigo-400 disabled:opacity-60"
      style={{ fontSize: '4.5cqmin' }}
    >
      <option value="">{placeholder}</option>
      {members.map((m) => {
        const isExcluded = excluded.has(m.userId) && m.userId !== value;
        const label =
          currentUserId && m.userId === currentUserId && youLabel ? youLabel : m.nickname;
        return (
          <option key={m.userId} value={m.userId} disabled={isExcluded}>
            {label}
          </option>
        );
      })}
    </select>
  );
}
