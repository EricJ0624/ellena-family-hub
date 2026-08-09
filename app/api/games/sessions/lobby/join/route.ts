import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { lobbyJoinGameSession } from '@/lib/family-games/session-service';
import type { LobbyJoinBody } from '@/lib/family-games/session-types';
import { getGroupMemberUserIds, notifyFamily } from '@/lib/notifications/notify';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = (await request.json()) as LobbyJoinBody;
    const { groupId, gameType } = body;

    if (!groupId || !gameType) {
      return NextResponse.json({ error: 'groupId, gameType가 필요합니다.' }, { status: 400 });
    }

    if (!['ladder', 'rps', 'roulette'].includes(gameType)) {
      return NextResponse.json({ error: '유효하지 않은 gameType입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const bundle = await lobbyJoinGameSession(supabase, user.id, body);

    try {
      const members = await getGroupMemberUserIds(groupId, supabase);
      await notifyFamily({
        groupId,
        actorUserId: user.id,
        recipientUserIds: members,
        widgetKey: 'games',
        eventType: 'GAME_LOBBY_JOINED',
        title: '🎲 게임 참가',
        body: '가족 멤버가 게임 로비에 참가했습니다.',
        url: '/dashboard?focus=games',
        entityId: bundle?.session?.id ? String(bundle.session.id) : null,
      });
    } catch (notifyError) {
      console.warn('game lobby join notify:', notifyError);
    }

    return NextResponse.json({ success: true, data: bundle });
  } catch (error) {
    const message = error instanceof Error ? error.message : '참가에 실패했습니다.';
    const status =
      message === 'WRONG_GAME_TYPE' || message === 'LOBBY_CLOSED'
        ? 409
        : message === 'LOBBY_FULL'
          ? 409
          : 500;
    console.error('POST /api/games/sessions/lobby/join error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
