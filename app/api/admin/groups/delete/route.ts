import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateUser,
  getSupabaseServerClient,
  deleteFromCloudinary,
  deleteFromS3,
  generateAppS3KeyFromMasterKey,
} from '@/lib/api-helpers';
import { isSystemAdmin } from '@/lib/permissions';
import { writeAdminAuditLog, getAuditRequestMeta } from '@/lib/admin-audit';

export async function DELETE(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // 시스템 관리자 확인
    const admin = await isSystemAdmin(user.id);
    if (!admin) {
      return NextResponse.json(
        { error: '시스템 관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { groupId } = body;

    if (!groupId) {
      return NextResponse.json(
        { error: '그룹 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 그룹 삭제 전: 해당 그룹의 memory_vault(사진) 조회 후 S3/Cloudinary에서 파일 삭제
    const { data: photos } = await supabase
      .from('memory_vault')
      .select('id, cloudinary_public_id, s3_key')
      .eq('group_id', groupId);

    if (photos && photos.length > 0) {
      const deletePromises: Promise<boolean>[] = [];
      for (const photo of photos) {
        if (photo.cloudinary_public_id) {
          deletePromises.push(deleteFromCloudinary(photo.cloudinary_public_id));
        }
        if (photo.s3_key) {
          deletePromises.push(deleteFromS3(photo.s3_key));
          const appKey = generateAppS3KeyFromMasterKey(photo.s3_key);
          deletePromises.push(deleteFromS3(appKey));
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
  } catch (error: any) {
    console.error('그룹 삭제 오류:', error);
    return NextResponse.json(
      { error: error.message || '그룹 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

