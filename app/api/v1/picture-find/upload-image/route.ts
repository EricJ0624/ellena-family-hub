import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import {
  generatePublicAssetUrl,
  generateS3KeyWithGroup,
  getS3ClientInstance,
} from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function normalizeMime(raw: string, fileName: string): string {
  const t = String(raw || '').trim().toLowerCase();
  if (t === 'image/jpg') return 'image/jpeg';
  if (t && t !== 'application/octet-stream') return t;
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return t;
}

/**
 * Browser → S3 PUT CORS/`Load failed` 회피: 서버가 S3에 직접 업로드.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const form = await request.formData();
    const groupId = String(form.get('groupId') || '');
    const file = form.get('file');

    if (!groupId) {
      return NextResponse.json({ error: 'groupId는 필수입니다.' }, { status: 400 });
    }
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: '이미지 파일이 필요합니다.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '파일 크기가 20MB를 초과합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const mime = normalizeMime(file.type, file.name);
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { error: '지원하지 않는 파일 형식입니다. (JPEG, PNG, WebP, HEIC)' },
        { status: 400 },
      );
    }

    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      return NextResponse.json({ error: 'AWS_S3_BUCKET_NAME 환경 변수가 필요합니다.' }, { status: 500 });
    }

    const safeName = String(file.name || 'photo.jpg').replace(/[^\w.\-]+/g, '_');
    const s3Key = generateS3KeyWithGroup(safeName, mime, user.id, groupId);
    const buffer = Buffer.from(await file.arrayBuffer());

    const s3 = getS3ClientInstance();
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: mime,
      }),
    );

    return NextResponse.json({
      success: true,
      s3Key,
      imageUrl: generatePublicAssetUrl(s3Key),
      sizeBytes: buffer.length,
      mimeType: mime,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '이미지 업로드 중 오류가 발생했습니다.';
    console.error('[picture-find/upload-image]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
