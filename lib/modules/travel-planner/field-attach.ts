/**
 * Attach field check-in / completed route to travel_itineraries.
 * - create: always insert a new itinerary
 * - attach: update a specific itinerary_id only
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type AttachFieldResult = {
  itineraryId: string;
  created: boolean;
};

export type FieldAttachMode = 'create' | 'attach';

type AttachBase = {
  supabase: SupabaseClient;
  groupId: string;
  tripId: string;
  userId: string;
  dayDate: string;
  timeHm: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  title: string;
  fieldRecordKind: 'checkin' | 'route';
  fieldTrackId?: string | null;
  endTimeHm?: string | null;
  description?: string | null;
  /** create = always new row; attach = only that itinerary */
  attachMode: FieldAttachMode;
  itineraryId?: string | null;
};

async function updateItinerary(
  params: AttachBase & { targetId: string },
): Promise<AttachFieldResult> {
  const {
    supabase,
    groupId,
    userId,
    latitude,
    longitude,
    address,
    fieldRecordKind,
    fieldTrackId,
    endTimeHm,
    description,
    targetId,
  } = params;
  const now = new Date().toISOString();

  const updatePayload: Record<string, unknown> = {
    updated_at: now,
    updated_by: userId,
    latitude,
    longitude,
    field_record_kind: fieldRecordKind,
  };
  if (address != null && String(address).trim()) {
    updatePayload.address = String(address).trim();
  }
  if (fieldTrackId) updatePayload.field_track_id = fieldTrackId;
  if (endTimeHm) updatePayload.end_time = String(endTimeHm).trim().substring(0, 5);
  if (description != null && String(description).trim()) {
    const { data: existing } = await supabase
      .from('travel_itineraries')
      .select('description')
      .eq('id', targetId)
      .maybeSingle();
    const prev = existing?.description ? String(existing.description).trim() : '';
    const add = String(description).trim();
    updatePayload.description = prev ? `${prev}\n${add}` : add;
  }

  const { data: updated, error: upErr } = await supabase
    .from('travel_itineraries')
    .update(updatePayload)
    .eq('id', targetId)
    .eq('group_id', groupId)
    .eq('trip_id', params.tripId)
    .is('deleted_at', null)
    .select('id')
    .single();

  if (upErr || !updated) {
    throw new Error(upErr?.message || 'Failed to update itinerary');
  }

  return { itineraryId: updated.id, created: false };
}

async function createItinerary(params: AttachBase): Promise<AttachFieldResult> {
  const {
    supabase,
    groupId,
    tripId,
    userId,
    dayDate,
    timeHm,
    latitude,
    longitude,
    address,
    title,
    fieldRecordKind,
    fieldTrackId,
    endTimeHm,
    description,
  } = params;

  const day = String(dayDate).slice(0, 10);
  const startHm = String(timeHm).trim().substring(0, 5);

  const { data: maxSort } = await supabase
    .from('travel_itineraries')
    .select('sort_order')
    .eq('trip_id', tripId)
    .eq('group_id', groupId)
    .eq('day_date', day)
    .is('deleted_at', null)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (maxSort?.sort_order != null ? Number(maxSort.sort_order) : 0) + 10;

  const insertPayload: Record<string, unknown> = {
    trip_id: tripId,
    group_id: groupId,
    day_date: day,
    title: title.trim() || (fieldRecordKind === 'route' ? '경로 기록' : '위치 기록'),
    description: description?.trim() || null,
    sort_order: sortOrder,
    start_time: startHm,
    end_time: endTimeHm ? String(endTimeHm).trim().substring(0, 5) : null,
    address: address?.trim() || null,
    latitude,
    longitude,
    place_type: 'other',
    field_record_kind: fieldRecordKind,
    field_track_id: fieldTrackId || null,
    created_by: userId,
    updated_by: userId,
  };

  const { data: created, error: insErr } = await supabase
    .from('travel_itineraries')
    .insert(insertPayload)
    .select('id')
    .single();

  if (insErr || !created) {
    throw new Error(insErr?.message || 'Failed to create itinerary from field record');
  }

  return { itineraryId: created.id, created: true };
}

export async function attachFieldToItinerary(params: AttachBase): Promise<AttachFieldResult> {
  if (params.attachMode === 'attach') {
    const id = params.itineraryId?.trim();
    if (!id) throw new Error('itinerary_id가 필요합니다.');
    return updateItinerary({ ...params, targetId: id });
  }
  return createItinerary(params);
}
