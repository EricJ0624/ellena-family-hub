import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { getGroupMemberUserIds, notifyFamily } from '@/lib/notifications/notify';
import { isNotifiableWidgetKey } from '@/lib/notifications/types';

export const runtime = 'nodejs';

const ALLOWED_EVENT_TYPES = new Set([
  'CHAT_MESSAGE',
  'TASK_ASSIGNED',
  'TASK_COMPLETED',
  'CALENDAR_EVENT_CREATED',
  'CALENDAR_EVENT_DELETED',
]);

/**
 * 클라이언트 mutation(채팅/임무/일정) 성공 후 알림 발송.
 * 서버에서 멤버십·허용 이벤트만 검증.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
    const widgetKey = typeof body.widgetKey === 'string' ? body.widgetKey.trim() : '';
    const eventType = typeof body.eventType === 'string' ? body.eventType.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
    const message = typeof body.body === 'string' ? body.body.trim().slice(0, 300) : '';
    const url = typeof body.url === 'string' && body.url.startsWith('/') ? body.url.slice(0, 500) : '/dashboard';
    const entityId =
      body.entityId == null ? null : String(body.entityId).slice(0, 100);
    const recipientUserIds = Array.isArray(body.recipientUserIds)
      ? body.recipientUserIds.map((id: unknown) => String(id)).filter(Boolean)
      : null;

    if (!groupId || !widgetKey || !eventType || !title || !message) {
      return NextResponse.json(
        { error: 'groupId, widgetKey, eventType, title, body가 필요합니다.' },
        { status: 400 },
      );
    }

    if (!isNotifiableWidgetKey(widgetKey)) {
      return NextResponse.json({ error: '지원하지 않는 위젯입니다.' }, { status: 400 });
    }

    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: '허용되지 않은 eventType입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const memberIds = await getGroupMemberUserIds(groupId, supabase);
    const memberSet = new Set(memberIds);

    let recipients: string[];
    if (recipientUserIds && recipientUserIds.length > 0) {
      recipients = recipientUserIds.filter((id: string) => memberSet.has(id) && id !== user.id);
    } else {
      recipients = memberIds.filter((id: string) => id !== user.id);
    }

    const result = await notifyFamily({
      groupId,
      actorUserId: user.id,
      recipientUserIds: recipients,
      widgetKey,
      eventType,
      title,
      body: message,
      url,
      entityId,
      payload: body.payload && typeof body.payload === 'object' ? body.payload : undefined,
      tag: entityId || eventType,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('POST /api/notifications/emit:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알림 발송 실패' },
      { status: 500 },
    );
  }
}
