import type { SupabaseClient } from '@supabase/supabase-js';
import { getGroupMemberUserIds, notifyFamily } from '@/lib/notifications/notify';

/** 여행 플래너 세부 변경 알림 (다이어리 제외). 실패해도 throw하지 않음. */
export async function notifyTravelDetailChanged(params: {
  supabase: SupabaseClient;
  groupId: string;
  actorUserId: string;
  tripId?: string | null;
  summary: string;
}): Promise<void> {
  try {
    const members = await getGroupMemberUserIds(params.groupId, params.supabase);
    await notifyFamily({
      groupId: params.groupId,
      actorUserId: params.actorUserId,
      recipientUserIds: members,
      widgetKey: 'travel',
      eventType: 'TRAVEL_DETAIL_CHANGED',
      title: '✈️ 여행 일정 변경',
      body: params.summary,
      url: params.tripId ? `/travel?tripId=${params.tripId}` : '/travel',
      entityId: params.tripId ?? null,
    });
  } catch (error) {
    console.warn('[notifyTravelDetailChanged]', error);
  }
}
