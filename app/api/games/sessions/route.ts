import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import {
  createGameSession,
  fetchActiveSessionForGroup,
  finalizeSessionAfterCreate,
} from '@/lib/family-games/session-service';
import type { CreateGameSessionBody } from '@/lib/family-games/session-types';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId) {
      return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const bundle = await fetchActiveSessionForGroup(supabase, groupId);

    return NextResponse.json({ success: true, data: bundle });
  } catch (error) {
    console.error('GET /api/games/sessions error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '세션 조회에 실패했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = (await request.json()) as CreateGameSessionBody;
    const { groupId, gameType, config } = body;

    if (!groupId || !gameType || !config) {
      return NextResponse.json({ error: 'groupId, gameType, config가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    let bundle = await createGameSession(supabase, user.id, body);
    bundle = await finalizeSessionAfterCreate(supabase, bundle);

    return NextResponse.json({ success: true, data: bundle });
  } catch (error) {
    const message = error instanceof Error ? error.message : '세션 생성에 실패했습니다.';
    if (message === 'ACTIVE_SESSION_EXISTS') {
      return NextResponse.json({ error: '이미 진행 중인 게임이 있습니다.' }, { status: 409 });
    }
    console.error('POST /api/games/sessions error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
