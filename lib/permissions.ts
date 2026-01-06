/**
 * Group Permission Verification Utilities
 * 
 * 실리콘밸리 시니어 엔지니어 수준의 권한 검증 시스템
 * IDOR (Insecure Direct Object Reference) 공격 방지 포함
 */

import { getSupabaseServerClient } from './api-helpers';
import type { MembershipRole } from '@/types/db';

/**
 * 권한 검증 결과 타입
 */
export type PermissionResult = 
  | { success: true; role: MembershipRole; isOwner: boolean }
  | { success: false; error: PermissionError };

/**
 * 권한 검증 에러 타입
 */
export enum PermissionError {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  GROUP_NOT_FOUND = 'GROUP_NOT_FOUND',
  NOT_A_MEMBER = 'NOT_A_MEMBER',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  IDOR_ATTEMPT = 'IDOR_ATTEMPT', // Insecure Direct Object Reference 공격 시도
  DATABASE_ERROR = 'DATABASE_ERROR',
}

/**
 * 권한 검증 함수
 * 
 * @param userId - 검증할 사용자 ID (auth.user.id와 일치해야 함)
 * @param groupId - 검증할 그룹 ID
 * @param requiredRole - 필요한 최소 권한 ('ADMIN' | 'MEMBER' | null)
 * @param authUserId - 현재 인증된 사용자 ID (IDOR 방지용)
 * 
 * @returns PermissionResult - 권한 검증 결과
 * 
 * @example
 * ```typescript
 * const result = await checkPermission(
 *   userId,
 *   groupId,
 *   'ADMIN',
 *   authUserId
 * );
 * 
 * if (!result.success) {
 *   return NextResponse.json(
 *     { error: result.error },
 *     { status: 403 }
 *   );
 * }
 * 
 * // result.role, result.isOwner 사용 가능
 * ```
 */
export async function checkPermission(
  userId: string,
  groupId: string,
  requiredRole: MembershipRole | null = null,
  authUserId?: string
): Promise<PermissionResult> {
  try {
    // IDOR 공격 방지: userId와 authUserId가 일치하는지 확인
    if (authUserId && userId !== authUserId) {
      console.warn('IDOR 공격 시도 감지:', {
        requestedUserId: userId,
        authUserId,
        groupId,
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        error: PermissionError.IDOR_ATTEMPT,
      };
    }

    // 입력값 검증
    if (!userId || !groupId) {
      return {
        success: false,
        error: PermissionError.USER_NOT_FOUND,
      };
    }

    // UUID 형식 검증 (보안 강화)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId) || !uuidRegex.test(groupId)) {
      return {
        success: false,
        error: PermissionError.USER_NOT_FOUND,
      };
    }

    // Supabase Admin SDK로 권한 확인 (RLS 우회)
    const supabase = getSupabaseServerClient();

    // 1. 그룹 존재 여부 및 소유자 확인
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, owner_id')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      console.error('그룹 조회 실패:', groupError);
      return {
        success: false,
        error: PermissionError.GROUP_NOT_FOUND,
      };
    }

    // 2. 멤버십 확인
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .single();

    if (membershipError || !membership) {
      // 멤버가 아니더라도 소유자인지 확인
      const isOwner = group.owner_id === userId;
      if (!isOwner) {
        return {
          success: false,
          error: PermissionError.NOT_A_MEMBER,
        };
      }
      // 소유자는 자동으로 ADMIN 권한을 가짐
      return {
        success: true,
        role: 'ADMIN',
        isOwner: true,
      };
    }

    // 3. 권한 레벨 확인
    const userRole = membership.role;
    const isOwner = group.owner_id === userId;

    // 소유자는 항상 ADMIN 권한
    const effectiveRole: MembershipRole = isOwner ? 'ADMIN' : userRole;

    // 4. 필요한 권한 확인
    if (requiredRole) {
      const roleHierarchy: Record<MembershipRole, number> = {
        MEMBER: 1,
        ADMIN: 2,
      };

      const requiredLevel = roleHierarchy[requiredRole];
      const userLevel = roleHierarchy[effectiveRole];

      if (userLevel < requiredLevel) {
        return {
          success: false,
          error: PermissionError.INSUFFICIENT_PERMISSIONS,
        };
      }
    }

    return {
      success: true,
      role: effectiveRole,
      isOwner,
    };
  } catch (error: any) {
    console.error('권한 검증 중 오류:', error);
    return {
      success: false,
      error: PermissionError.DATABASE_ERROR,
    };
  }
}

/**
 * 그룹 멤버 여부 확인 (권한 레벨 무관)
 * 
 * @param userId - 확인할 사용자 ID
 * @param groupId - 그룹 ID
 * @returns boolean - 멤버 여부
 */
export async function isGroupMember(
  userId: string,
  groupId: string
): Promise<boolean> {
  const result = await checkPermission(userId, groupId, null);
  return result.success;
}

/**
 * 그룹 ADMIN 권한 확인
 * 
 * @param userId - 확인할 사용자 ID
 * @param groupId - 그룹 ID
 * @returns boolean - ADMIN 권한 여부
 */
export async function isGroupAdmin(
  userId: string,
  groupId: string
): Promise<boolean> {
  const result = await checkPermission(userId, groupId, 'ADMIN');
  return result.success && result.role === 'ADMIN';
}

/**
 * 그룹 소유자 확인
 * 
 * @param userId - 확인할 사용자 ID
 * @param groupId - 그룹 ID
 * @returns boolean - 소유자 여부
 */
export async function isGroupOwner(
  userId: string,
  groupId: string
): Promise<boolean> {
  const result = await checkPermission(userId, groupId, null);
  return result.success && result.isOwner;
}

/**
 * 시스템 관리자 여부 확인
 * 
 * @param userId - 확인할 사용자 ID (기본값: 현재 인증된 사용자)
 * @returns boolean - 시스템 관리자 여부
 */
export async function isSystemAdmin(userId?: string): Promise<boolean> {
  try {
    const supabase = getSupabaseServerClient();
    
    // userId가 제공되지 않으면 현재 인증된 사용자 확인
    if (!userId) {
      // 클라이언트 사이드에서는 직접 쿼리 불가하므로 RPC 함수 사용
      // 서버 사이드에서는 직접 쿼리 가능
      const { data, error } = await supabase.rpc('is_system_admin');
      if (error) {
        console.error('시스템 관리자 확인 오류:', error);
        return false;
      }
      return data === true;
    }
    
    // 특정 사용자 ID로 확인
    const { data, error } = await supabase.rpc('is_system_admin', {
      user_id_param: userId,
    });
    
    if (error) {
      console.error('시스템 관리자 확인 오류:', error);
      return false;
    }
    
    return data === true;
  } catch (error: any) {
    console.error('시스템 관리자 확인 중 오류:', error);
    return false;
  }
}

