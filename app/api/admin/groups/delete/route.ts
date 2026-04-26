import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient, deleteFromS3 } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { writeAdminAuditLog, getAuditRequestMeta } from '@/lib/admin-audit';
import { DB_TABLES } from '@/lib/db-table-names';

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const body = await request.json();
    const { groupId } = body;

    if (!groupId) {
      return NextResponse.json(
        { error: '그룹 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 그룹 삭제 전: 해당 그룹의 memory_vault(사진) 조회 후 S3에서 파일 삭제 (Cloudinary 제거)
    const { data: photos } = await supabase
      .from(DB_TABLES.FAMILY_ALBUM_ITEMS)
      .select('id, s3_key')
      .eq('group_id', groupId);

    if (photos && photos.length > 0) {
      const deletePromises: Promise<boolean>[] = [];
      for (const photo of photos) {
        if (photo.s3_key) {
          deletePromises.push(deleteFromS3(photo.s3_key));
        }
      }
      await Promise.all(deletePromises);
    }

    // 그룹 삭제 (CASCADE로 memberships, memory_vault 등 삭제됨)
    const { error: deleteError } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (deleteError) {
      throw deleteError;
    }

    const { ipAddress, userAgent } = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'DELETE',
      resourceType: 'group',
      resourceId: groupId,
      groupId,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: '그룹이 삭제되었습니다.',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '그룹 삭제 중 오류가 발생했습니다.';
    console.error('그룹 삭제 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

