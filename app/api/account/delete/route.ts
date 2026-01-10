import { NextRequest, NextResponse } from 'next/server';
import { 
  authenticateUser, 
  getSupabaseServerClient,
  deleteFromCloudinary,
  deleteFromS3
} from '@/lib/api-helpers';

/**
 * 회원탈퇴 API
 * 
 * 사용자 계정 및 관련 데이터를 완전히 삭제합니다.
 * - auth.users 삭제 (CASCADE로 관련 데이터 자동 삭제)
 * - Push 토큰 삭제
 * - 그룹 소유자인 경우 그룹 삭제 또는 경고
 */
export async function DELETE(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const supabaseServer = getSupabaseServerClient();

    // 1. 그룹 소유 여부 확인
    const { data: ownedGroups, error: groupsError } = await supabaseServer
      .from('groups')
      .select('id, name')
      .eq('owner_id', user.id);

    if (groupsError) {
      console.error('그룹 조회 실패:', groupsError);
      return NextResponse.json(
        { error: '그룹 정보를 확인하는데 실패했습니다.' },
        { status: 500 }
      );
    }

    // 2. 소유한 그룹이 있으면 경고 (선택사항: 그룹 삭제 또는 소유권 이전)
    if (ownedGroups && ownedGroups.length > 0) {
      // 소유한 그룹이 있으면 삭제 불가 (또는 그룹도 함께 삭제)
      // 여기서는 그룹도 함께 삭제하는 것으로 처리
      // 실제로는 프론트엔드에서 확인 후 요청해야 함
      for (const group of ownedGroups) {
        // 그룹 삭제 (CASCADE로 memberships도 자동 삭제)
        const { error: deleteGroupError } = await supabaseServer
          .from('groups')
          .delete()
          .eq('id', group.id);

        if (deleteGroupError) {
          console.error(`그룹 삭제 실패 (${group.id}):`, deleteGroupError);
        }
      }
    }

    // 3. Push 토큰 삭제
    try {
      const { data: pushTokens } = await supabaseServer
        .from('push_tokens')
        .select('id')
        .eq('user_id', user.id);

      if (pushTokens && pushTokens.length > 0) {
        await supabaseServer
          .from('push_tokens')
          .delete()
          .eq('user_id', user.id);
      }
    } catch (pushError) {
      console.warn('Push 토큰 삭제 실패 (무시):', pushError);
      // Push 토큰 삭제 실패해도 계속 진행
    }

    // 4. 사용자 위치 데이터 삭제
    try {
      await supabaseServer
        .from('user_locations')
        .delete()
        .eq('user_id', user.id);
    } catch (locationError) {
      console.warn('위치 데이터 삭제 실패 (무시):', locationError);
    }

    // 5. 위치 요청 데이터 삭제 (요청자 또는 대상자)
    try {
      await supabaseServer
        .from('location_requests')
        .delete()
        .or(`requester_id.eq.${user.id},target_id.eq.${user.id}`);
    } catch (requestError) {
      console.warn('위치 요청 데이터 삭제 실패 (무시):', requestError);
    }

    // 6. 메모리 볼트 데이터 삭제 (Cloudinary, S3 파일도 함께 삭제)
    try {
      // 먼저 파일 정보 조회
      const { data: photos } = await supabaseServer
        .from('memory_vault')
        .select('id, cloudinary_public_id, s3_key')
        .eq('uploader_id', user.id);

      if (photos && photos.length > 0) {
        // Cloudinary와 S3에서 파일 삭제
        const deletePromises: Promise<boolean>[] = [];
        
        for (const photo of photos) {
          if (photo.cloudinary_public_id) {
            deletePromises.push(deleteFromCloudinary(photo.cloudinary_public_id));
          }
          if (photo.s3_key) {
            deletePromises.push(deleteFromS3(photo.s3_key));
          }
        }

        // 모든 삭제 작업 병렬 실행
        await Promise.all(deletePromises);

        if (process.env.NODE_ENV === 'development') {
          console.log(`사용자 파일 삭제 완료: ${photos.length}개 파일 (Cloudinary, S3)`);
        }
      }

      // Supabase에서 레코드 삭제
      await supabaseServer
        .from('memory_vault')
        .delete()
        .eq('uploader_id', user.id);
    } catch (memoryError) {
      console.warn('메모리 볼트 데이터 삭제 실패 (무시):', memoryError);
    }

    // 7. auth.users 삭제 (CASCADE로 profiles, memberships 등 자동 삭제)
    const { error: deleteUserError } = await supabaseServer.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      console.error('사용자 삭제 실패:', deleteUserError);
      return NextResponse.json(
        { error: '계정 삭제에 실패했습니다.', details: deleteUserError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '회원탈퇴가 완료되었습니다.',
    });

  } catch (error: any) {
    console.error('회원탈퇴 처리 오류:', error);
    return NextResponse.json(
      { error: '회원탈퇴 처리 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

