import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { fetchSessionBundle, joinGameSession } from '@/lib/family-games/session-service';
import { getGroupMemberUserIds, notifyFamily } from '@/lib/notifications/notify';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id } = await params;
    const supabase = getSupabaseServerClient();
    const bundle = await fetchSessionBundle(supabase, id);

    if (!bundle) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
    }

    const memberCheck = await requireGroupMember(user.id, bundle.session.group_id);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const participant = await joinGameSession(supabase, id, user.id);

    try {
      const members = await getGroupMemberUserIds(bundle.session.group_id, supabase);
      await notifyFamily({
        groupId: bundle.session.group_id,
        actorUserId: user.id,
        recipientUserIds: members,
        widgetKey: 'games',
        eventType: 'GAME_LOBBY_JOINED',
        title: '🎲 게임 참가',
        body: '가족 멤버가 게임에 참가했습니다.',
        url: '/dashboard?focus=games',
        entityId: String(id),
      });
    } catch (notifyError) {
      console.warn('game session join notify:', notifyError);
    }

    return NextResponse.json({ success: true, data: participant });
  } catch (error) {
    const message = error instanceof Error ? error.message : '참가에 실패했습니다.';
    if (message === 'NOT_A_PARTICIPANT') {
      return NextResponse.json({ error: '이 게임의 참가자가 아닙니다.' }, { status: 403 });
    }
    console.error('POST /api/games/sessions/[id]/join error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
