import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';
import type { FamilyRole } from '@/types/db';

const VALID_FAMILY_ROLES: (FamilyRole | null)[] = [null, 'mom', 'dad', 'son', 'daughter', 'other'];

/**
 * 가족 표시 역할(family_role) 설정 API
 * - 소유자/관리자: mom, dad 만 허용
 * - 멤버: son, daughter, other 만 허용
 * - null(미설정) 항상 허용
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
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
        { error: '유효하지 않은 가족 역할입니다. (mom, dad, son, daughter, other 또는 미설정)' },
        { status: 400 }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetUserId) || !uuidRegex.test(groupId)) {
      return NextResponse.json({ error: '유효하지 않은 ID 형식입니다.' }, { status: 400 });
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

    const { data: group } = await supabase
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();

    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', targetUserId)
      .eq('group_id', groupId)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: '해당 사용자는 이 그룹의 멤버가 아닙니다.' },
        { status: 404 }
      );
    }

    const isOwnerOrAdmin = group?.owner_id === targetUserId || membership.role === 'ADMIN';
    const value = familyRole === undefined ? null : familyRole;

    if (value !== null) {
      if (isOwnerOrAdmin && !['mom', 'dad'].includes(value)) {
        return NextResponse.json(
          { error: '소유자/관리자는 엄마(mom) 또는 아빠(dad)만 선택할 수 있습니다.' },
          { status: 400 }
        );
      }
      if (!isOwnerOrAdmin && !['son', 'daughter', 'other'].includes(value)) {
        return NextResponse.json(
          { error: '멤버는 아들(son), 딸(daughter), 기타(other)만 선택할 수 있습니다.' },
          { status: 400 }
        );
      }
    }

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
  } catch (error: any) {
    console.error('가족 역할 설정 오류:', error);
    return NextResponse.json(
      { error: error.message || '가족 역할 설정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
