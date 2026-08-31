import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuthUser } from '@/lib/api-guards';
import { GROUP_SUSPENDED_CODE } from '@/lib/account-suspend-access';
import { normalizeGroupIdFromRpc } from '@/lib/validation';

function getUserSupabase(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase client config missing');
  }
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * 이메일 초대 수락 → memberships 추가, group_id 반환
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await context.params;
    const inviteId = id?.trim();
    if (!inviteId) {
      return NextResponse.json({ error: '초대 ID가 필요합니다.' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
    }

    const supabase = getUserSupabase(token);
    const { data: groupIdRaw, error } = await supabase.rpc('accept_group_email_invite', {
      p_invite_id: inviteId,
    });

    if (error) {
      const message = error.message || '';
      if (message.includes('GROUP_SUSPENDED')) {
        return NextResponse.json(
          { error: '이 그룹은 현재 이용할 수 없습니다.', code: GROUP_SUSPENDED_CODE },
          { status: 403 },
        );
      }
      if (message.includes('expired')) {
        return NextResponse.json({ error: '초대가 만료되었습니다.' }, { status: 410 });
      }
      if (message.includes('no longer pending') || message.includes('not found')) {
        return NextResponse.json({ error: '유효하지 않거나 이미 처리된 초대입니다.' }, { status: 409 });
      }
      console.error('accept_group_email_invite error:', error);
      return NextResponse.json({ error: '초대 수락에 실패했습니다.' }, { status: 500 });
    }

    const groupId = normalizeGroupIdFromRpc(groupIdRaw);
    if (!groupId) {
      return NextResponse.json({ error: '그룹 연결에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, group_id: groupId });
  } catch (err) {
    console.error('group email invite accept error:', err);
    return NextResponse.json({ error: '초대 수락 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
