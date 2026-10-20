'use client';

import { supabase } from '@/lib/supabase';
import type { LangCode } from '@/lib/language-fonts';
import { getBillingTranslation } from '@/lib/translations/billing';

export function billingLimitHref(groupId: string, intent: 'seats' | 'storage'): string {
  return `/billing?groupId=${encodeURIComponent(groupId)}&intent=${intent}`;
}

export function isSeatLimitPayload(payload: { code?: unknown; error?: unknown }): boolean {
  if (payload.code === 'BILLING_SEAT_REQUIRED') return true;
  const error = typeof payload.error === 'string' ? payload.error : '';
  return error.includes('BILLING_SEAT_REQUIRED') || error.includes('기본 2명을 넘기려면');
}

export function isStorageLimitMessage(message: string): boolean {
  return message.includes('그룹 저장 용량을 초과했습니다');
}

type LimitState = {
  isOwner: boolean;
  betaPeriodEnabled: boolean;
  memberCount: number;
  allowedSeats: number;
};

async function fetchLimitState(groupId: string): Promise<LimitState | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;
    const res = await fetch(`/api/billing/group-state?groupId=${encodeURIComponent(groupId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as {
      isOwner?: unknown;
      betaPeriodEnabled?: unknown;
      memberCount?: unknown;
      allowedSeats?: unknown;
    } | null;
    if (!json) return null;
    return {
      isOwner: json.isOwner === true,
      betaPeriodEnabled: json.betaPeriodEnabled !== false,
      memberCount: typeof json.memberCount === 'number' ? json.memberCount : 0,
      allowedSeats: typeof json.allowedSeats === 'number' ? json.allowedSeats : 2,
    };
  } catch {
    return null;
  }
}

function withBetaNote(lang: LangCode, question: string, beta: boolean): string {
  if (!beta) return question;
  return `${question}\n${getBillingTranslation(lang, 'beta_virtual_note')}`;
}

function goBilling(groupId: string, intent: 'seats' | 'storage') {
  window.location.assign(billingLimitHref(groupId, intent));
}

function confirmOwner(lang: LangCode, questionKey: 'seat_owner_confirm' | 'storage_owner_confirm' | 'original_owner_confirm', beta: boolean): boolean {
  return window.confirm(withBetaNote(lang, getBillingTranslation(lang, questionKey), beta));
}

/** 가입·승인이 인원 한도에 막혔을 때. 소유자면 확인 후 결제 페이지. */
export async function presentSeatLimit(lang: LangCode, groupId: string): Promise<void> {
  const state = await fetchLimitState(groupId);
  if (state?.isOwner) {
    if (confirmOwner(lang, 'seat_owner_confirm', state.betaPeriodEnabled)) {
      goBilling(groupId, 'seats');
    }
    return;
  }
  window.alert(getBillingTranslation(lang, 'seat_required'));
}

/** 업로드가 용량 한도에 막혔을 때. */
export async function presentStorageLimit(lang: LangCode, groupId: string): Promise<void> {
  const state = await fetchLimitState(groupId);
  if (state?.isOwner) {
    if (confirmOwner(lang, 'storage_owner_confirm', state.betaPeriodEnabled)) {
      goBilling(groupId, 'storage');
    }
    return;
  }
  window.alert(getBillingTranslation(lang, 'storage_ask_owner'));
}

/** 원본 업로드를 고랐는데 20GB가 없을 때. */
export async function presentOriginalUploadLimit(lang: LangCode, groupId: string): Promise<void> {
  const state = await fetchLimitState(groupId);
  if (state?.isOwner) {
    if (confirmOwner(lang, 'original_owner_confirm', state.betaPeriodEnabled)) {
      goBilling(groupId, 'storage');
    }
    return;
  }
  window.alert(getBillingTranslation(lang, 'original_ask_owner'));
}

/**
 * 이메일 초대 직전. 이미 한도면 안내하고 true (전송하지 않음).
 * 한도 조회가 실패하면 false로 기존 초대 흐름을 유지한다.
 */
export async function pauseEmailInviteForSeatLimit(lang: LangCode, groupId: string): Promise<boolean> {
  const state = await fetchLimitState(groupId);
  if (!state || state.memberCount < state.allowedSeats) return false;
  if (state.isOwner) {
    if (confirmOwner(lang, 'seat_owner_confirm', state.betaPeriodEnabled)) {
      goBilling(groupId, 'seats');
    }
    return true;
  }
  window.alert(getBillingTranslation(lang, 'seat_required'));
  return true;
}
