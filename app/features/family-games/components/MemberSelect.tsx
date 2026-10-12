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

const ID_PLACEHOLDER_LABEL = /^사용자\s+[0-9a-f-]{6,}$/i;

export function isOpaqueIdLabel(label: string, userId: string): boolean {
  const value = label.trim();
  const id = userId.trim();
  if (!value || !id) return true;
  if (ID_PLACEHOLDER_LABEL.test(value)) return true;
  if (value === id) return true;
  const compact = id.replace(/-/g, '');
  const head = id.slice(0, 8);
  const compactHead = compact.slice(0, 8);
  const tail = id.length > 8 ? id.slice(-8) : id;
  const compactTail = compact.length > 8 ? compact.slice(-8) : compact;
  return (
    value === compact ||
    value === head ||
    value === compactHead ||
    value === tail ||
    value === compactTail
  );
}

/** 프로필 별명 → 표시 이름 → 이메일. 아이디로 만든 임시 이름은 쓰지 않는다. */
export function profileNicknameLabel(
  profile: { nickname?: string | null; display_name?: string | null; email?: string | null } | null | undefined,
  userId: string,
): string {
  const nickname = profile?.nickname?.trim() || '';
  const displayName = profile?.display_name?.trim() || '';
  const email = profile?.email?.trim() || '';
  const chosen = nickname || displayName || email;
  if (!chosen || isOpaqueIdLabel(chosen, userId)) return '';
  return chosen;
}

export function getMemberNickname(
  members: FamilyTaskMemberOption[],
  userId: string,
  currentUserId?: string,
  youLabel?: string,
): string {
  if (!userId) return '';
  const found = members.find((m) => m.userId === userId);
  if (!found) return '';
  if (currentUserId && found.userId === currentUserId && youLabel) return youLabel;
  if (isOpaqueIdLabel(found.nickname, userId)) return '';
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
      style={{ fontSize: '4.5cqw' }}
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
