import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  generatePublicAssetUrl,
  generateS3KeyWithGroup,
  getS3ClientInstance,
} from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { fileName, mimeType, fileSize, groupId, isThumbnail } = body ?? {};

    if (!fileName || !mimeType || !groupId) {
      return NextResponse.json({ error: 'fileName, mimeType, groupId는 필수입니다.' }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(String(mimeType))) {
      return NextResponse.json({ error: '지원하지 않는 파일 형식입니다.' }, { status: 400 });
    }
    if (typeof fileSize !== 'number' || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '파일 크기는 1B~20MB여야 합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, String(groupId));
    if (memberCheck instanceof NextResponse) return memberCheck;

    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      return NextResponse.json({ error: 'AWS_S3_BUCKET_NAME 환경 변수가 필요합니다.' }, { status: 500 });
    }

    const safeName = String(fileName).replace(/[^\w.\-]+/g, '_');
    const baseKey = generateS3KeyWithGroup(safeName, String(mimeType), user.id, String(groupId));
    const s3Key = isThumbnail ? `${baseKey}.thumb` : baseKey;

    const s3Client = getS3ClientInstance();
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      ContentType: String(mimeType),
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
