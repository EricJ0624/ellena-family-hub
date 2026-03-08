import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateUser,
  getSupabaseServerClient,
  downloadFromS3,
} from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';

/**
 * 사진 파일 다운로드 (S3 → 스트림, Content-Disposition: attachment)
 * GET /api/photo/download?id=<memory_vault.id>
 * Authorization: Bearer <access_token> 필요
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { error: 'id가 필요합니다.', usage: '/api/photo/download?id=<memory_vault.id>' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const { data: row, error: fetchError } = await supabase
      .from('memory_vault')
      .select('id, group_id, s3_key, original_filename, mime_type, upload_mode')
      .eq('id', id)
      .single();

    if (fetchError || !row) {
      return NextResponse.json(
        { error: '사진을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const groupId = row.group_id as string | null;
    if (!groupId) {
      return NextResponse.json(
        { error: '사진 그룹 정보가 없습니다.' },
        { status: 404 }
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
        { error: '해당 사진을 볼 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const s3Key = row.s3_key as string | null;
    if (!s3Key) {
      return NextResponse.json(
        { error: '이 사진은 다운로드를 지원하지 않습니다. (S3 키 없음)' },
        { status: 404 }
      );
    }

    const blob = await downloadFromS3(s3Key);
    const mimeType = (row.mime_type as string) || 'image/jpeg';
    const uploadMode = (row.upload_mode as string) || 'normal';
    const prefix = uploadMode === 'original' ? 'original_' : 'normal_';
    let filename = (row.original_filename as string) || '';
    if (!filename || /\s*\.\s*$/.test(filename)) {
      const ext = mimeType === 'image/png' ? 'png' : 'jpg';
      filename = `photo-${id}.${ext}`;
    }
    if (!/\.(jpe?g|png|gif|webp)$/i.test(filename)) {
      const ext = mimeType === 'image/png' ? 'png' : 'jpg';
      filename = filename.replace(/\s*$/, '') ? `${filename}.${ext}` : `photo-${id}.${ext}`;
    }
    filename = prefix + filename;
    const safeName = filename.replace(/[^\w.\-가-힣]/g, '_');
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (e) {
    console.error('Photo download error:', e);
    return NextResponse.json(
      { error: '다운로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
