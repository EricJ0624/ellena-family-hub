'use client';

import React from 'react';
import type { FamilyTaskMemberOption } from '@/app/features/family-tasks/types';
import { MemberSelect } from './MemberSelect';

export interface ParticipantSetupPickerProps {
  members: FamilyTaskMemberOption[];
  userId: string;
  slotIds: string[];
  onSlotIdsChange: (ids: string[]) => void;
  minSlots?: number;
  maxSlots: number;
  selectPlaceholder: string;
  youLabel: string;
  addLabel: string;
  removeLabel: string;
}

export function ParticipantSetupPicker({
  members,
  userId,
  slotIds,
  onSlotIdsChange,
  minSlots = 2,
  maxSlots,
  selectPlaceholder,
  youLabel,
  addLabel,
  removeLabel,
}: ParticipantSetupPickerProps) {
  const updateSlot = (index: number, value: string) => {
    onSlotIdsChange(slotIds.map((id, i) => (i === index ? value : id)));
  };

  const addSlot = () => {
    if (slotIds.length >= maxSlots) return;
    onSlotIdsChange([...slotIds, '']);
  };

  const removeLastSlot = () => {
    if (slotIds.length <= minSlots) return;
    onSlotIdsChange(slotIds.slice(0, -1));
  };

  const canAdd = slotIds.length < maxSlots && slotIds.length < members.length;
  const canRemove = slotIds.length > minSlots;

  return (
    <div className="games-setup-scroll grid" style={{ gap: '1.5cqmin' }}>
      <div className="games-field-list grid">
        {slotIds.map((value, index) => (
          <MemberSelect
            key={`setup-slot-${index}`}
            members={members}
            value={value}
            onChange={(next) => updateSlot(index, next)}
            placeholder={selectPlaceholder}
            currentUserId={userId}
            youLabel={youLabel}
            excludeUserIds={slotIds.filter((id, i) => i !== index && Boolean(id.trim()))}
          />
        ))}
      </div>
      <div className="flex flex-wrap" style={{ gap: '1cqmin' }}>
        <button
          type="button"
          onClick={addSlot}
          disabled={!canAdd}
          className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white disabled:opacity-50"
          style={{ fontSize: '4cqmin' }}
        >
          {addLabel}
        </button>
        {canRemove && (
          <button
            type="button"
            onClick={removeLastSlot}
            className="rounded-lg bg-slate-200 px-3 py-2 font-semibold text-slate-700"
            style={{ fontSize: '4cqmin' }}
          >
            {removeLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function areParticipantSlotsReady(slotIds: string[], minSlots = 2): boolean {
  return (
    slotIds.length >= minSlots &&
    slotIds.every((id) => id.trim()) &&
    new Set(slotIds).size === slotIds.length
  );
}
