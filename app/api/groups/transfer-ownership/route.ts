import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser } from '@/lib/api-guards';
import { CURRENT_APP_ID } from '@/lib/apps';
import { GROUP_SUSPENDED_CODE } from '@/lib/account-suspend-access';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 그룹 소유자 → 다른 멤버에게 소유권 이양.
 * 시스템 관리자 이양(/api/admin/system-admins/transfer)과 무관.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json().catch(() => ({}));
    const { groupId, newOwnerId } = body as {
      groupId?: string;
      newOwnerId?: string;
    };

    if (!groupId || !newOwnerId) {
      return NextResponse.json(
        { error: 'groupId와 newOwnerId가 필요합니다.' },
        { status: 400 },
      );
    }
    if (!UUID_RE.test(groupId) || !UUID_RE.test(newOwnerId)) {
      return NextResponse.json({ error: '유효하지 않은 ID 형식입니다.' }, { status: 400 });
    }
    if (newOwnerId === user.id) {
      return NextResponse.json(
        { error: '본인에게는 소유권을 이양할 수 없습니다.' },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: suspended, error: suspendError } = await supabase.rpc(
      'is_user_suspended_in_group',
      { p_user_id: user.id, p_group_id: groupId },
    );
    if (suspendError || suspended) {
      return NextResponse.json(
        { error: '이 그룹은 현재 이용할 수 없습니다.', code: GROUP_SUSPENDED_CODE },
        { status: 403 },
      );
    }

    const { data: groupRow, error: groupError } = await supabase
      .from('groups')
      .select('id, owner_id, name, app_id')
      .eq('id', groupId)
      .eq('app_id', CURRENT_APP_ID)
      .maybeSingle();

    if (groupError || !groupRow) {
      return NextResponse.json({ error: '그룹을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (groupRow.owner_id !== user.id) {
      return NextResponse.json(
        { error: '그룹 소유자만 소유권을 이양할 수 있습니다.' },
        { status: 403 },
      );
    }

    const { data: targetMembership, error: memError } = await supabase
      .from('memberships')
      .select('user_id, group_id, role, app_id')
      .eq('user_id', newOwnerId)
      .eq('group_id', groupId)
      .eq('app_id', CURRENT_APP_ID)
      .maybeSingle();

    if (memError || !targetMembership) {
      return NextResponse.json(
        { error: '새 소유자는 해당 그룹의 멤버여야 합니다.' },
        { status: 400 },
      );
    }

    const { error: updateOwnerError } = await supabase
      .from('groups')
      .update({ owner_id: newOwnerId })
      .eq('id', groupId)
      .eq('owner_id', user.id)
      .eq('app_id', CURRENT_APP_ID);

    if (updateOwnerError) {
      console.error('소유권 이양 groups update 실패:', updateOwnerError);
      return NextResponse.json({ error: '소유권 이양에 실패했습니다.' }, { status: 500 });
    }

    const { error: promoteError } = await supabase
      .from('memberships')
      .update({ role: 'ADMIN' })
      .eq('user_id', newOwnerId)
      .eq('group_id', groupId)
      .eq('app_id', CURRENT_APP_ID);

    if (promoteError) {
      console.error('새 소유자 ADMIN 승격 실패:', promoteError);
      await supabase
        .from('groups')
        .update({ owner_id: user.id })
        .eq('id', groupId)
        .eq('app_id', CURRENT_APP_ID);
      return NextResponse.json({ error: '소유권 이양에 실패했습니다.' }, { status: 500 });
    }

    const { data: prevMem } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .eq('app_id', CURRENT_APP_ID)
      .maybeSingle();

    if (!prevMem) {
      const { error: insertPrev } = await supabase.from('memberships').insert({
        user_id: user.id,
        group_id: groupId,
        role: 'ADMIN',
        app_id: CURRENT_APP_ID,
      });
      if (insertPrev) {
        console.warn('이전 소유자 memberships 보강 실패:', insertPrev);
      }
    } else {
      await supabase
        .from('memberships')
        .update({ role: 'ADMIN' })
        .eq('user_id', user.id)
        .eq('group_id', groupId)
        .eq('app_id', CURRENT_APP_ID);
    }

    return NextResponse.json({
      success: true,
      message: `${groupRow.name} 그룹 소유권을 이양했습니다.`,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '소유권 이양 중 오류가 발생했습니다.';
    console.error('그룹 소유권 이양 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
