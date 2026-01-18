import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { isSystemAdmin } from '@/lib/permissions';
import { DEFAULT_GROUP_STORAGE_QUOTA_BYTES, getGroupStorageUsedBytes } from '@/lib/storage-quota';

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const admin = await isSystemAdmin(user.id);
    if (!admin) {
      return NextResponse.json(
        { error: '시스템 관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseServerClient();
    const { data: groupsData, error: groupsError } = await supabase
      .from('groups')
      .select('id, name, owner_id, created_at, storage_quota_bytes')
      .order('created_at', { ascending: false })
      .limit(100);

    if (groupsError) {
      console.error('그룹 조회 오류:', groupsError);
      return NextResponse.json(
        { error: '그룹 목록 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    if (!groupsData || groupsData.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const groupsWithDetails = await Promise.all(
      groupsData.map(async (group) => {
        const { data: ownerData } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', group.owner_id)
          .single();

        let memberCount = 0;
        try {
          const { count } = await supabase
            .from('memberships')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);
          memberCount = count || 0;
        } catch (countError) {
          console.warn(`그룹 ${group.id} 멤버 수 조회 오류:`, countError);
        }

        const usedBytes = await getGroupStorageUsedBytes(group.id);

        return {
          id: group.id,
          name: group.name,
          owner_email: ownerData?.email || null,
          member_count: memberCount,
          created_at: group.created_at,
          storage_quota_bytes: group.storage_quota_bytes ?? DEFAULT_GROUP_STORAGE_QUOTA_BYTES,
          storage_used_bytes: usedBytes,
        };
      })
    );

    return NextResponse.json({ success: true, data: groupsWithDetails });
  } catch (error: any) {
    console.error('그룹 저장 용량 조회 오류:', error);
    return NextResponse.json(
      { error: error.message || '그룹 저장 용량 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const admin = await isSystemAdmin(user.id);
    if (!admin) {
      return NextResponse.json(
        { error: '시스템 관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { groupId, storageQuotaBytes, storageQuotaGb } = body;

    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId가 필요합니다.' },
        { status: 400 }
      );
    }

    const resolvedQuotaBytes =
      typeof storageQuotaBytes === 'number'
        ? storageQuotaBytes
        : typeof storageQuotaGb === 'number'
          ? Math.round(storageQuotaGb * 1024 * 1024 * 1024)
          : null;

    if (!resolvedQuotaBytes || resolvedQuotaBytes <= 0) {
      return NextResponse.json(
        { error: 'storageQuotaBytes 또는 storageQuotaGb가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const { data: updated, error: updateError } = await supabase
      .from('groups')
      .update({ storage_quota_bytes: resolvedQuotaBytes })
      .eq('id', groupId)
      .select('id, storage_quota_bytes')
      .single();

    if (updateError) {
      console.error('그룹 용량 업데이트 오류:', updateError);
      return NextResponse.json(
        { error: '그룹 용량 업데이트에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('그룹 저장 용량 업데이트 오류:', error);
    return NextResponse.json(
      { error: error.message || '그룹 저장 용량 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
