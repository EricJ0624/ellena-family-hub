import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser } from '@/lib/api-guards';
import { brandSystemAdminCopy } from '@/lib/system-admin-brand';

/**
 * 회원탈퇴 API
 *
 * 사용자 계정 및 개인 데이터를 삭제합니다.
 * - 가족 채팅·일정·할 일·앨범·여행은 남기고 작성자만 비움 (FK SET NULL)
 * - 프로필·위치·푸시 등 개인 데이터는 CASCADE 삭제
 * - 소유 그룹이 남아 있으면 거절 (그룹 삭제·소유권 이양은 /account 에서 선행)
 * - 시스템 관리자 탈퇴 차단은 기존과 동일
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const supabaseServer = getSupabaseServerClient();

    // 0. 시스템 관리자 여부 확인 (회원탈퇴 방지) — 기존 로직 유지
    const { data: isAdmin } = await supabaseServer
      .from('system_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    if (isAdmin) {
      return NextResponse.json(
        {
          error: 'ADMIN_ACCOUNT',
          message: brandSystemAdminCopy(
            '시스템 관리자는 회원탈퇴할 수 없습니다. 먼저 관리자 권한을 해제하거나 후임자를 지정해주세요.',
          ),
          isSystemAdmin: true,
        },
        { status: 403 },
      );
    }

    // 1. 소유 그룹이 있으면 거절 (일괄 그룹 삭제 경로 없음)
    const { data: ownedGroups, error: groupsError } = await supabaseServer
      .from('groups')
      .select('id, name')
      .eq('owner_id', user.id);

    if (groupsError) {
      console.error('그룹 조회 실패:', groupsError);
      return NextResponse.json(
        { error: '그룹 정보를 확인하는데 실패했습니다.' },
        { status: 500 },
      );
    }

    if (ownedGroups && ownedGroups.length > 0) {
      return NextResponse.json(
        {
          error: 'OWNED_GROUPS_REMAIN',
          message:
            '소유 중인 그룹이 있습니다. 계정 페이지에서 그룹을 삭제하거나 소유권을 이양한 뒤 회원 탈퇴해 주세요.',
          ownedGroupCount: ownedGroups.length,
          ownedGroups: ownedGroups.map((g) => ({ id: g.id, name: g.name })),
        },
        { status: 400 },
      );
    }

    // 2. Push 토큰 삭제
    try {
      const { data: pushTokens } = await supabaseServer
        .from('push_tokens')
        .select('id')
        .eq('user_id', user.id);

      if (pushTokens && pushTokens.length > 0) {
        await supabaseServer.from('push_tokens').delete().eq('user_id', user.id);
      }
    } catch (pushError) {
      console.warn('Push 토큰 삭제 실패 (무시):', pushError);
    }

    // 3. 사용자 위치 데이터 삭제
    try {
      await supabaseServer.from('user_locations').delete().eq('user_id', user.id);
    } catch (locationError) {
      console.warn('위치 데이터 삭제 실패 (무시):', locationError);
    }

    // 4. 위치 요청 데이터 삭제
    try {
      await supabaseServer
        .from('location_requests')
        .delete()
        .or(`requester_id.eq.${user.id},target_id.eq.${user.id}`);
    } catch (requestError) {
      console.warn('위치 요청 데이터 삭제 실패 (무시):', requestError);
    }

    // 5. 공지 읽음 기록
    try {
      await supabaseServer.from('announcement_reads').delete().eq('user_id', user.id);
    } catch (readCleanupError) {
      console.warn('announcement_reads 삭제 실패 (무시):', readCleanupError);
    }

    // 6. auth.users 삭제 (CASCADE로 profiles, memberships 등)
    const { error: deleteUserError } = await supabaseServer.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      console.error('사용자 삭제 실패:', deleteUserError);
      return NextResponse.json(
        { error: '계정 삭제에 실패했습니다.', details: deleteUserError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: '회원탈퇴가 완료되었습니다.',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('회원탈퇴 처리 오류:', error);
    return NextResponse.json(
      { error: '회원탈퇴 처리 중 오류가 발생했습니다.', details: errorMessage },
      { status: 500 },
    );
  }
}
