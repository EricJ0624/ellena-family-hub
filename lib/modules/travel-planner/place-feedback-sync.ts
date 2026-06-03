import type { SupabaseClient } from '@supabase/supabase-js';
import {
  defaultExpenseCategoryForKind,
  type TravelPlaceSourceKind,
} from '@/lib/modules/travel-planner/unified-itinerary';

export type PlaceFeedbackSyncInput = {
  groupId: string;
  tripId: string;
  sourceKind: TravelPlaceSourceKind;
  sourceId: string;
  userId: string;
  rating?: number | null;
  isRevisit?: boolean | null;
  feedbackNote?: string | null;
  /** Actual spend at this place; triggers travel_expenses sync */
  actualExpense?: number | null;
  expenseDate?: string;
  placeTitle?: string;
  tripCurrency?: string;
};

export type PlaceFeedbackRow = {
  id: string;
  group_id: string;
  trip_id: string;
  source_kind: string;
  source_id: string;
  rating: number | null;
  is_revisit: boolean | null;
  feedback_note: string | null;
  travel_expense_id: string | null;
};

/**
 * Policy when actual_expense is cleared (null / 0):
 * Soft-delete the linked travel_expenses row and set travel_expense_id to null.
 * Prevents duplicate diary_origin rows per place (one expense per source_kind+source_id).
 */
const CLEAR_EXPENSE_SOFT_DELETES = true;

function hasPositiveAmount(n: number | null | undefined): boolean {
  return n != null && Number.isFinite(n) && Number(n) > 0;
}

function buildExpenseMemo(placeTitle: string | undefined, note: string | null | undefined): string | null {
  const parts: string[] = [];
  if (placeTitle?.trim()) parts.push(placeTitle.trim());
  if (note?.trim()) parts.push(note.trim());
  return parts.length ? parts.join(' · ') : null;
}

async function softDeleteExpense(
  supabase: SupabaseClient,
  expenseId: string,
  groupId: string,
  userId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from('travel_expenses')
    .update({ deleted_at: now, deleted_by: userId, updated_at: now, updated_by: userId })
    .eq('id', expenseId)
    .eq('group_id', groupId)
    .is('deleted_at', null);
}

async function upsertLinkedExpense(
  supabase: SupabaseClient,
  input: PlaceFeedbackSyncInput,
  existingExpenseId: string | null,
): Promise<string | null> {
  const amount = input.actualExpense;
  if (!hasPositiveAmount(amount ?? null)) {
    if (existingExpenseId && CLEAR_EXPENSE_SOFT_DELETES) {
      await softDeleteExpense(supabase, existingExpenseId, input.groupId, input.userId);
    }
    return null;
  }

  const now = new Date().toISOString();
  const currency =
    String(input.tripCurrency || 'KRW')
      .trim()
      .toUpperCase() || 'KRW';
  const expenseDate = (input.expenseDate || '').slice(0, 10);
  if (!expenseDate) {
    throw new Error('expenseDate가 필요합니다.');
  }

  const payload = {
    trip_id: input.tripId,
    group_id: input.groupId,
    entry_type: 'expense' as const,
    category: defaultExpenseCategoryForKind(input.sourceKind),
    amount: Number(amount),
    currency,
    paid_by: null,
    memo: buildExpenseMemo(input.placeTitle, input.feedbackNote),
    expense_date: expenseDate,
    source_kind: input.sourceKind,
    source_id: input.sourceId,
    diary_origin: true,
    updated_at: now,
    updated_by: input.userId,
  };

  if (existingExpenseId) {
    const { data, error } = await supabase
      .from('travel_expenses')
      .update(payload)
      .eq('id', existingExpenseId)
      .eq('group_id', input.groupId)
      .is('deleted_at', null)
      .select('id')
      .single();
    if (error) throw error;
    return data?.id ?? existingExpenseId;
  }

  const { data, error } = await supabase
    .from('travel_expenses')
    .insert({
      ...payload,
      created_by: input.userId,
      created_at: now,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data?.id ?? null;
}

/**
 * UPSERT travel_place_feedback and sync travel_expenses (one row per place).
 */
export async function syncPlaceFeedbackWithExpense(
  supabase: SupabaseClient,
  input: PlaceFeedbackSyncInput,
): Promise<PlaceFeedbackRow> {
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from('travel_place_feedback')
    .select('id, travel_expense_id')
    .eq('group_id', input.groupId)
    .eq('source_kind', input.sourceKind)
    .eq('source_id', input.sourceId)
    .is('deleted_at', null)
    .maybeSingle();

  const expenseId = await upsertLinkedExpense(
    supabase,
    input,
    (existing as { travel_expense_id?: string | null } | null)?.travel_expense_id ?? null,
  );

  const feedbackPayload = {
    group_id: input.groupId,
    trip_id: input.tripId,
    source_kind: input.sourceKind,
    source_id: input.sourceId,
    rating: input.rating ?? null,
    is_revisit: input.isRevisit ?? null,
    feedback_note: input.feedbackNote?.trim() ? input.feedbackNote.trim() : null,
    travel_expense_id: expenseId,
    updated_at: now,
    updated_by: input.userId,
  };

  if (existing?.id) {
    const { data, error } = await supabase
      .from('travel_place_feedback')
      .update(feedbackPayload)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data as PlaceFeedbackRow;
  }

  const { data, error } = await supabase
    .from('travel_place_feedback')
    .insert({
      ...feedbackPayload,
      created_by: input.userId,
      created_at: now,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as PlaceFeedbackRow;
}
