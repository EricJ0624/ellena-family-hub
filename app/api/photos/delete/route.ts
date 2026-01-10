import { NextRequest, NextResponse } from 'next/server';
import { 
  authenticateUser, 
  getSupabaseServerClient,
  deleteFromCloudinary,
  deleteFromS3
} from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';

export async function DELETE(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // 요청 본문에서 photoId 추출
    const body = await request.json().catch(() => ({}));
    const { photoId, groupId } = body;

    if (!photoId) {
      return NextResponse.json(
        { error: 'photoId가 필요합니다.' },
        { status: 400 }
      );
    }

    // Multi-tenant 아키텍처: groupId 필수 검증
    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId는 필수입니다. Multi-tenant 아키텍처에서는 모든 데이터에 groupId가 필요합니다.' },
        { status: 400 }
      );
    }

    // 그룹 권한 검증
    const permissionResult = await checkPermission(
      user.id,
      groupId,
      null, // MEMBER 이상 권한 필요
      user.id
    );

    if (!permissionResult.success) {
      return NextResponse.json(
        { error: '그룹 접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // Supabase에서 파일 정보 조회 (삭제 전에)
    const supabaseServer = getSupabaseServerClient();
    const { data: photoData, error: fetchError } = await supabaseServer
      .from('memory_vault')
      .select('id, uploader_id, cloudinary_public_id, s3_key, group_id')
      .eq('id', photoId)
      .eq('group_id', groupId) // Multi-tenant: group_id 검증
      .single();

    if (fetchError || !photoData) {
      return NextResponse.json(
        { error: '사진을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 권한 확인: 업로드한 사용자 또는 그룹 ADMIN만 삭제 가능
    const isOwner = photoData.uploader_id === user.id;
    const isAdmin = permissionResult.role === 'ADMIN' || permissionResult.isOwner;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: '사진을 삭제할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 1. Cloudinary에서 파일 삭제
    let cloudinaryDeleted = false;
    if (photoData.cloudinary_public_id) {
      cloudinaryDeleted = await deleteFromCloudinary(photoData.cloudinary_public_id);
      if (process.env.NODE_ENV === 'development') {
        console.log('Cloudinary 삭제 결과:', {
          publicId: photoData.cloudinary_public_id,
          success: cloudinaryDeleted
        });
      }
    }

    // 2. S3에서 파일 삭제
    let s3Deleted = false;
    if (photoData.s3_key) {
      s3Deleted = await deleteFromS3(photoData.s3_key);
      if (process.env.NODE_ENV === 'development') {
        console.log('S3 삭제 결과:', {
          s3Key: photoData.s3_key,
          success: s3Deleted
        });
      }
    }

    // 3. Supabase에서 레코드 삭제
    const { error: deleteError } = await supabaseServer
      .from('memory_vault')
      .delete()
      .eq('id', photoId)
      .eq('group_id', groupId); // Multi-tenant: group_id 검증

    if (deleteError) {
      console.error('Supabase 삭제 오류:', deleteError);
      return NextResponse.json(
        { error: '데이터베이스에서 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 성공 응답 (일부 삭제 실패해도 DB 삭제는 성공했으므로 성공으로 처리)
    return NextResponse.json({
      success: true,
      photoId,
      cloudinaryDeleted,
      s3Deleted,
      message: '사진이 삭제되었습니다.'
    });

  } catch (error: any) {
    console.error('사진 삭제 오류:', error);
    return NextResponse.json(
      { error: error.message || '사진 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
