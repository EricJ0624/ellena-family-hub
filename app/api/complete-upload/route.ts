import { NextRequest, NextResponse } from 'next/server';
import { 
  authenticateUser, 
  base64ToBlob, 
  uploadToCloudinary, 
  downloadFromS3,
  getSupabaseServerClient
} from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const body = await request.json();
    const { 
      s3Key,
      s3Url,
      fileName,
      mimeType,
      originalSize,
      resizedData, // 리사이징된 이미지 (Base64, 선택적)
      groupId, // 그룹 ID (선택적, 있으면 권한 검증)
    } = body;

    if (!s3Key || !s3Url || !fileName || !mimeType) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 그룹 권한 검증 (groupId가 제공된 경우)
    if (groupId) {
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
    }

    // 1. Cloudinary에 리사이징된 이미지 업로드 (표시용)
    let cloudinaryUrl = '';
    let cloudinaryPublicId = '';
    
    try {
      let cloudinaryBlob: Blob;
      
      if (resizedData) {
        // 리사이징된 이미지가 있으면 사용
        cloudinaryBlob = base64ToBlob(resizedData, mimeType);
      } else {
        // 리사이징된 이미지가 없으면 S3에서 원본 다운로드
        try {
          cloudinaryBlob = await downloadFromS3(s3Key);
        } catch (s3DownloadError: any) {
          console.error('S3에서 파일 다운로드 실패:', s3DownloadError);
          // S3 다운로드 실패 시 Cloudinary 업로드를 건너뛰고 Supabase 저장만 진행
          throw new Error('S3에서 파일을 다운로드할 수 없습니다. Cloudinary 업로드를 건너뜁니다.');
        }
      }

      const cloudinaryResult = await uploadToCloudinary(
        cloudinaryBlob,
        fileName,
        mimeType,
        user.id
      );
      cloudinaryUrl = cloudinaryResult.url;
      cloudinaryPublicId = cloudinaryResult.publicId;
    } catch (cloudinaryError: any) {
      console.error('Cloudinary 업로드 오류:', cloudinaryError);
      // Cloudinary 업로드 실패해도 Supabase 저장은 계속 진행
      // 에러 메시지에 따라 다르게 처리
      if (cloudinaryError.message?.includes('S3에서 파일을 다운로드할 수 없습니다')) {
        console.warn('S3 다운로드 실패로 Cloudinary 업로드를 건너뜁니다.');
      }
    }

    // 2. Supabase memory_vault 테이블에 저장
    const fileType = mimeType.startsWith('image/') ? 'photo' : 'video';
    
    // image_url은 필수 컬럼이므로 cloudinary_url 우선, 없으면 s3_original_url 사용
    const imageUrl = cloudinaryUrl || s3Url;
    
    // 서버 사이드용 Supabase 클라이언트 사용 (RLS 정책 우회)
    const supabaseServer = getSupabaseServerClient();
    
    const { data: memoryData, error: dbError } = await supabaseServer
      .from('memory_vault')
      .insert({
        uploader_id: user.id,
        image_url: imageUrl, // 필수 컬럼: cloudinary_url 우선, 없으면 s3_original_url
        cloudinary_url: cloudinaryUrl || null,
        s3_original_url: s3Url,
        file_type: fileType,
        original_file_size: originalSize || null,
        cloudinary_public_id: cloudinaryPublicId || null,
        s3_key: s3Key,
        mime_type: mimeType,
        original_filename: fileName,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Supabase 저장 오류:', dbError);
      // 업로드는 성공했지만 DB 저장 실패 시에도 URL 반환
      return NextResponse.json({
        success: true,
        warning: '파일 업로드는 성공했지만 데이터베이스 저장에 실패했습니다.',
        cloudinaryUrl,
        s3Url,
        s3Key,
        cloudinaryPublicId,
      });
    }

    return NextResponse.json({
      success: true,
      id: memoryData.id,
      cloudinaryUrl,
      s3Url,
      s3Key,
      cloudinaryPublicId,
      fileType,
    });

  } catch (error: any) {
    console.error('업로드 완료 처리 오류:', error);
    return NextResponse.json(
      { error: error.message || '업로드 완료 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}



