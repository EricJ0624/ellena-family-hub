import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { fetchSessionBundle, performGameSessionAction } from '@/lib/family-games/session-service';
import type { GameSessionAction } from '@/lib/family-games/session-types';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id } = await params;
    const body = await request.json();
    const action = body?.action as GameSessionAction | undefined;

    if (!action?.type) {
      return NextResponse.json({ error: 'action.type이 필요합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const existing = await fetchSessionBundle(supabase, id);
    if (!existing) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
    }

    const memberCheck = await requireGroupMember(user.id, existing.session.group_id);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const bundle = await performGameSessionAction(supabase, id, user.id, action);

    return NextResponse.json({ success: true, data: bundle });
  } catch (error) {
    const message = error instanceof Error ? error.message : '액션 처리에 실패했습니다.';
    const status =
      message === 'HOST_ONLY' || message === 'FORBIDDEN' || message === 'NOT_A_PARTICIPANT'
        ? 403
        : message === 'SESSION_NOT_FOUND'
          ? 404
          : 400;
    console.error('PATCH /api/games/sessions/[id]/action error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
