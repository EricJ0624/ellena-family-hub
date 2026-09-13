import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser } from '@/lib/api-guards';
import { checkPermission, isSystemAdmin } from '@/lib/permissions';
import { GROUP_SUSPENDED_CODE } from '@/lib/account-suspend-access';
import type { FamilyRole } from '@/types/db';

const VALID_FAMILY_ROLES: (FamilyRole | null)[] = [null, 'mom', 'dad', 'son', 'daughter', 'grandpa', 'grandma', 'other'];

/**
 * 가족 표시 역할(family_role) 설정 API
 * - family_role은 권한(ADMIN/MEMBER)과 무관하게 동일 옵션 허용
 * - null(미설정) 항상 허용
 * - 본인 또는 관리자만 변경 가능 (ADMIN/MEMBER 권한 모델은 유지)
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { targetUserId, groupId, familyRole } = body as {
      targetUserId?: string;
      groupId?: string;
      familyRole?: FamilyRole | null;
    };

    if (!targetUserId || !groupId) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다. (targetUserId, groupId)' },
        { status: 400 }
      );
    }

    if (familyRole !== null && familyRole !== undefined && !VALID_FAMILY_ROLES.includes(familyRole)) {
      return NextResponse.json(
        { error: '유효하지 않은 가족 역할입니다. (mom, dad, son, daughter, grandpa, grandma, other 또는 미설정)' },
        { status: 400 }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetUserId) || !uuidRegex.test(groupId)) {
      return NextResponse.json({ error: '유효하지 않은 ID 형식입니다.' }, { status: 400 });
    }

    if (!(await isSystemAdmin(user.id))) {
      const supabaseForSuspend = getSupabaseServerClient();
      const { data: suspended, error: suspendError } = await supabaseForSuspend.rpc(
        'is_user_suspended_in_group',
        { p_user_id: user.id, p_group_id: groupId },
      );
      if (suspendError || suspended) {
        return NextResponse.json(
          { error: '이 그룹은 현재 이용할 수 없습니다.', code: GROUP_SUSPENDED_CODE },
          { status: 403 },
        );
      }
    }

    // 본인만 자신의 family_role 변경 가능 (또는 관리자만 변경 가능하도록 할 경우 checkPermission ADMIN)
    const isSelf = targetUserId === user.id;
    if (!isSelf) {
      const permissionResult = await checkPermission(user.id, groupId, 'ADMIN', user.id);
      if (!permissionResult.success) {
        return NextResponse.json(
          { error: '다른 멤버의 가족 역할은 관리자만 변경할 수 있습니다.' },
          { status: 403 }
        );
      }
    } else {
      const permissionResult = await checkPermission(user.id, groupId, null, user.id);
      if (!permissionResult.success) {
        return NextResponse.json({ error: '그룹 멤버만 설정할 수 있습니다.' }, { status: 403 });
      }
    }

    const supabase = getSupabaseServerClient();

    const { data: membership } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('user_id', targetUserId)
      .eq('group_id', groupId)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: '해당 사용자는 이 그룹의 멤버가 아닙니다.' },
        { status: 404 }
      );
    }

    const value = familyRole === undefined ? null : familyRole;

    const { error: updateError } = await supabase
      .from('memberships')
      .update({ family_role: value })
      .eq('user_id', targetUserId)
      .eq('group_id', groupId);

    if (updateError) {
      console.error('family_role 업데이트 오류:', updateError);
      return NextResponse.json(
        { error: updateError.message || '가족 역할 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { targetUserId, groupId, family_role: value },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '가족 역할 설정 중 오류가 발생했습니다.';
    console.error('가족 역할 설정 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
