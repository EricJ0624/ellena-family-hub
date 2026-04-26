import { NextRequest, NextResponse } from 'next/server';
import {
  deleteFromS3,
  generatePublicAssetUrl,
  getSupabaseServerClient,
} from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { DB_TABLES } from '@/lib/db-table-names';
import { getGroupStorageStats } from '@/lib/storage-quota';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const {
      s3Key,
      s3Url,
      fileName,
      mimeType,
      originalSize,
      groupId,
      upload_mode, // 'normal' | 'original'
      taken_at,
    } = body;

    if (!s3Key || !s3Url || !fileName || !mimeType) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId는 필수입니다.' },
        { status: 400 }
      );
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const incomingSize = originalSize || 0;
    if (incomingSize > MAX_FILE_SIZE) {
      await deleteFromS3(s3Key);
      return NextResponse.json(
        { error: `파일 크기가 20MB를 초과합니다. (${(incomingSize / 1024 / 1024).toFixed(2)}MB)` },
        { status: 413 }
      );
    }

    if (incomingSize) {
      const { quotaBytes, usedBytes } = await getGroupStorageStats(groupId);
      if (usedBytes + incomingSize > quotaBytes) {
        await deleteFromS3(s3Key);
        return NextResponse.json(
          {
            error: '그룹 저장 용량을 초과했습니다.',
            details: `현재 사용량 ${(usedBytes / 1024 / 1024 / 1024).toFixed(2)}GB / 한도 ${(quotaBytes / 1024 / 1024 / 1024).toFixed(2)}GB`,
          },
          { status: 413 }
        );
      }
    }

    const mode = upload_mode === 'original' ? 'original' : 'normal';
    const fileType = mimeType.startsWith('image/') ? 'photo' : 'video';

    // 표시 URL: 일반/원본 모두 CloudFront → S3 직달 (Cloudinary 제거)
    const imageUrl = generatePublicAssetUrl(s3Key);

    const supabaseServer = getSupabaseServerClient();
    const { data: memoryData, error: dbError } = await supabaseServer
      .from(DB_TABLES.FAMILY_ALBUM_ITEMS)
      .insert({
        uploader_id: user.id,
        group_id: groupId,
        image_url: imageUrl,
        s3_original_url: s3Url,
        file_type: fileType,
        original_file_size: originalSize || null,
        s3_key: s3Key,
        mime_type: mimeType,
        original_filename: fileName,
        taken_at: taken_at && typeof taken_at === 'string' ? taken_at : null,
        upload_mode: mode,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Supabase 저장 오류:', dbError);
      return NextResponse.json({
        success: true,
        warning: '파일 업로드는 성공했지만 데이터베이스 저장에 실패했습니다.',
        s3Url,
        s3Key,
      });
    }

    return NextResponse.json({
      success: true,
      id: memoryData.id,
      s3Url: imageUrl,
      s3Key,
      fileType,
      upload_mode: mode,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '업로드 완료 처리 중 오류가 발생했습니다.';
    console.error('업로드 완료 처리 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
