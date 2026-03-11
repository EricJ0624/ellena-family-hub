import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateUser,
  base64ToBlob,
  checkS3Config,
  generatePublicAssetUrl,
  getSupabaseServerClient,
  uploadToS3WithGroup,
} from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';
import { getGroupStorageStats } from '@/lib/storage-quota';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
// Vercel body 제한: Base64 시 약 1.33배 → 3MB 파일까지
const MAX_BODY_SIZE = 3 * 1024 * 1024;

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: '요청 데이터가 너무 큽니다. Presigned URL 방식을 사용해주세요.' },
        { status: 413 }
      );
    }

    const {
      originalData,
      fileName,
      mimeType,
      originalSize,
      groupId,
      upload_mode,
      taken_at,
    } = body as {
      originalData?: string;
      fileName?: string;
      mimeType?: string;
      originalSize?: number;
      groupId?: string;
      upload_mode?: string;
      taken_at?: string;
    };

    if (!originalData || !fileName || !mimeType) {
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

    const permissionResult = await checkPermission(
      user.id,
      groupId,
      null,
      user.id
    );
    if (!permissionResult.success) {
      return NextResponse.json(
        { error: '그룹 접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const estimatedSize = (originalData.length * 3) / 4;
    if (estimatedSize > MAX_BODY_SIZE) {
      return NextResponse.json(
        {
          error: `파일이 너무 큽니다. (최대 ${MAX_BODY_SIZE / 1024 / 1024}MB). Presigned URL을 사용해주세요.`,
        },
        { status: 413 }
      );
    }
    const incomingSize = originalSize || estimatedSize;
    if (incomingSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '파일이 20MB를 초과합니다.' },
        { status: 413 }
      );
    }

    const { quotaBytes, usedBytes } = await getGroupStorageStats(groupId);
    if (usedBytes + incomingSize > quotaBytes) {
      return NextResponse.json(
        {
          error: '그룹 저장 용량을 초과했습니다.',
          details: `현재 사용량 ${(usedBytes / 1024 / 1024 / 1024).toFixed(2)}GB / 한도 ${(quotaBytes / 1024 / 1024 / 1024).toFixed(2)}GB`,
        },
        { status: 413 }
      );
    }

    const s3Config = checkS3Config();
    if (!s3Config.available) {
      return NextResponse.json(
        { error: `S3 config missing: ${s3Config.missing.join(', ')}` },
        { status: 500 }
      );
    }

    const blob = await base64ToBlob(originalData, mimeType);
    const s3Result = await uploadToS3WithGroup(
      blob,
      fileName,
      mimeType,
      user.id,
      groupId
    );

    const mode = upload_mode === 'normal' ? 'normal' : 'original';
    // 일반/원본 모두 CloudFront → S3 직달 URL (Cloudinary 제거)
    const imageUrl = generatePublicAssetUrl(s3Result.key);
    const fileType = mimeType.startsWith('image/') ? 'photo' : 'video';

    const supabaseServer = getSupabaseServerClient();
    const { data: memoryData, error: dbError } = await supabaseServer
      .from('memory_vault')
      .insert({
        uploader_id: user.id,
        group_id: groupId,
        image_url: imageUrl,
        s3_original_url: s3Result.url,
        file_type: fileType,
        original_file_size: originalSize ?? blob.size,
        s3_key: s3Result.key,
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
        s3Url: imageUrl,
        s3Key: s3Result.key,
      });
    }

    return NextResponse.json({
      success: true,
      id: memoryData.id,
      s3Url: imageUrl,
      s3Key: s3Result.key,
      fileType,
      upload_mode: mode,
    });
  } catch (error: any) {
    console.error('업로드 오류:', error);
    return NextResponse.json(
      { error: error.message || '업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
