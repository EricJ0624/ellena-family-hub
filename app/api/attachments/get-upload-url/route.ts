import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  generatePublicAssetUrl,
  generateS3KeyWithGroup,
  getS3ClientInstance,
} from '@/lib/api-helpers';
import { requireAttachmentGroupAccess, requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { getGroupStorageStats } from '@/lib/storage-quota';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function normalizeClientMime(m: string): string {
  const s = String(m || '').trim().toLowerCase();
  if (s === 'image/jpg') return 'image/jpeg';
  return s;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { fileName, mimeType, fileSize, groupId, isThumbnail, entityType } = body ?? {};
    const mimeNorm = normalizeClientMime(String(mimeType || ''));

    if (!fileName || !mimeNorm || !groupId) {
      return NextResponse.json({ error: 'fileName, mimeType, groupId는 필수입니다.' }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(mimeNorm)) {
      return NextResponse.json({ error: '지원하지 않는 파일 형식입니다.' }, { status: 400 });
    }
    if (typeof fileSize !== 'number' || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '파일 크기가 20MB를 초과합니다. (최대 20MB)' }, { status: 400 });
    }

    const entity = String(entityType || '');
    const memberCheck = entity
      ? await requireAttachmentGroupAccess(user.id, String(groupId), entity)
      : await requireGroupMember(user.id, String(groupId));
    if (memberCheck instanceof NextResponse) return memberCheck;

    // 원본만 그룹 용량에 합산·검사 (썸네일은 size_bytes 미집계)
    if (!isThumbnail) {
      const { quotaBytes, usedBytes } = await getGroupStorageStats(String(groupId));
      if (usedBytes + fileSize > quotaBytes) {
        return NextResponse.json(
          {
            error: '그룹 저장 용량을 초과했습니다.',
            details: `현재 사용량 ${(usedBytes / 1024 / 1024 / 1024).toFixed(2)}GB / 한도 ${(quotaBytes / 1024 / 1024 / 1024).toFixed(2)}GB`,
          },
          { status: 413 },
        );
      }
    }

    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      return NextResponse.json({ error: 'AWS_S3_BUCKET_NAME 환경 변수가 필요합니다.' }, { status: 500 });
    }

    const safeName = String(fileName).replace(/[^\w.\-]+/g, '_');
    const baseKey = generateS3KeyWithGroup(safeName, mimeNorm, user.id, String(groupId));
    const s3Key = isThumbnail ? `${baseKey}.thumb` : baseKey;

    const s3Client = getS3ClientInstance();
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      ContentType: mimeNorm,
    });
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return NextResponse.json({
      success: true,
      presignedUrl,
      s3Key,
      s3Url: generatePublicAssetUrl(s3Key),
      expiresIn: 900,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '업로드 URL 생성 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
