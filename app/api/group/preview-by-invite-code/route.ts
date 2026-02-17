import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';

/**
 * 초대 코드로 그룹 미리보기 조회 (비멤버용).
 * 서버에서 service role로 groups 조회하여 RLS 우회.
 * - 로그인 사용자만 호출 가능.
 * - 초대코드 유효(존재·만료 아님)할 때만 id, name, invite_code, member_count 반환.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json().catch(() => ({}));
    const inviteCode = typeof body?.invite_code === 'string' ? body.invite_code.trim() : '';

    if (!inviteCode) {
      return NextResponse.json(
        { error: '올바른 초대 코드를 입력해 주세요.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, name, invite_code, invite_code_expires_at')
      .eq('invite_code', inviteCode)
      .maybeSingle();

    if (groupError || !group) {
      return NextResponse.json(
        { error: '올바른 초대 코드를 입력해 주세요.' },
        { status: 400 }
      );
    }

    if (group.invite_code_expires_at) {
      const expiresAt = new Date(group.invite_code_expires_at);
      if (expiresAt <= new Date()) {
        return NextResponse.json(
          { error: '올바른 초대 코드를 입력해 주세요.' },
          { status: 400 }
        );
      }
    }

    const { count } = await supabase
      .from('memberships')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', group.id);

    return NextResponse.json({
      id: group.id,
      name: group.name,
      invite_code: group.invite_code,
      member_count: count ?? 0,
    });
  } catch (err) {
    console.error('초대 코드 미리보기 오류:', err);
    return NextResponse.json(
      { error: '올바른 초대 코드를 입력해 주세요.' },
      { status: 400 }
    );
  }
}
