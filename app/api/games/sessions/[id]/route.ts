import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { fetchSessionBundle } from '@/lib/family-games/session-service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    return NextResponse.json({ success: true, data: bundle });
  } catch (error) {
    console.error('GET /api/games/sessions/[id] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '세션 조회에 실패했습니다.' },
      { status: 500 },
    );
  }
}
