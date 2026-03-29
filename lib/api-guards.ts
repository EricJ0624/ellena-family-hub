/**
 * API 라우트 공통 가드 함수들
 * 
 * 인증·권한 검증 패턴을 중복 없이 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from './api-helpers';
import { checkPermission, isSystemAdmin } from './permissions';
import type { MembershipRole } from '@/types/db';

/**
 * 인증 필수 가드
 * 
 * @param request - NextRequest
 * @returns 인증된 사용자 또는 에러 응답
 * 
 * @example
 * const authResult = await requireAuthUser(request);
 * if (authResult instanceof NextResponse) return authResult;
 * const { user } = authResult;
 */
export async function requireAuthUser(request: NextRequest): Promise<
  { user: { id: string; email?: string } } | NextResponse
> {
  const authResult = await authenticateUser(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  return authResult;
}

/**
 * 시스템 관리자 필수 가드
 * 
 * @param userId - 검증할 사용자 ID
 * @returns void (성공) 또는 에러 응답
 * 
 * @example
 * const adminCheck = await requireSystemAdmin(user.id);
 * if (adminCheck instanceof NextResponse) return adminCheck;
 */
export async function requireSystemAdmin(userId: string): Promise<void | NextResponse> {
  const isAdmin = await isSystemAdmin(userId);
  if (!isAdmin) {
    return NextResponse.json(
      { error: '시스템 관리자 권한이 필요합니다.' },
      { status: 403 }
    );
  }
}

/**
 * 그룹 관리자 필수 가드
 * 
 * @param userId - 검증할 사용자 ID
 * @param groupId - 그룹 ID
 * @returns PermissionResult (성공) 또는 에러 응답
 * 
 * @example
 * const permCheck = await requireGroupAdmin(user.id, groupId);
 * if (permCheck instanceof NextResponse) return permCheck;
 * const { role, isOwner } = permCheck;
 */
export async function requireGroupAdmin(
  userId: string,
  groupId: string
): Promise<
  | { role: MembershipRole; isOwner: boolean }
  | NextResponse
> {
  const permissionResult = await checkPermission(userId, groupId, 'ADMIN', userId);
  
  if (!permissionResult.success) {
    return NextResponse.json(
      { error: '그룹 관리자 권한이 필요합니다.', details: permissionResult.error },
      { status: 403 }
    );
  }
  
  return {
    role: permissionResult.role,
    isOwner: permissionResult.isOwner,
  };
}

/**
 * 그룹 멤버 필수 가드
 * 
 * @param userId - 검증할 사용자 ID
 * @param groupId - 그룹 ID
 * @returns PermissionResult (성공) 또는 에러 응답
 */
export async function requireGroupMember(
  userId: string,
  groupId: string
): Promise<
  | { role: MembershipRole; isOwner: boolean }
  | NextResponse
> {
  const permissionResult = await checkPermission(userId, groupId, null, userId);
  
  if (!permissionResult.success) {
    return NextResponse.json(
      { error: '그룹 접근 권한이 없습니다.', details: permissionResult.error },
      { status: 403 }
    );
  }
  
  return {
    role: permissionResult.role,
    isOwner: permissionResult.isOwner,
  };
}

/**
 * 여행(trip)이 그룹에 속하는지 검증
 * 
 * @param tripId - 여행 ID
 * @param groupId - 그룹 ID
 * @returns void (성공) 또는 에러 응답
 * 
 * @example
 * const tripCheck = await assertTripInGroup(tripId, groupId);
 * if (tripCheck instanceof NextResponse) return tripCheck;
 */
export async function assertTripInGroup(
  tripId: string,
  groupId: string
): Promise<void | NextResponse> {
  const supabase = getSupabaseServerClient();
  const { data: trip } = await supabase
    .from('travel_trips')
    .select('id')
    .eq('id', tripId)
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .single();
  
  if (!trip) {
    return NextResponse.json(
      { error: '여행을 찾을 수 없습니다.' },
      { status: 404 }
    );
  }
}
