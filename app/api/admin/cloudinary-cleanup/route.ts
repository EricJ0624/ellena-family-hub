import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateUser,
  deleteFromCloudinary,
  getSupabaseServerClient,
} from '@/lib/api-helpers';
import { isSystemAdmin } from '@/lib/permissions';

/**
 * [일회성] DB에 cloudinary_public_id가 있는 모든 레코드에 대해
 * Cloudinary에서 자산 삭제 후 DB의 cloudinary_url, cloudinary_public_id를 null로 업데이트합니다.
 * 옵션 A(변환만 사용) 전환 후 기존 Cloudinary 저장 용량을 비우기 위해 시스템 관리자가 1회 호출합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const admin = await isSystemAdmin(user.id);
    if (!admin) {
      return NextResponse.json(
        { error: '시스템 관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: rows, error: fetchError } = await supabase
      .from('memory_vault')
      .select('id, cloudinary_public_id')
      .not('cloudinary_public_id', 'is', null);

    if (fetchError) {
      console.error('Cloudinary cleanup fetch error:', fetchError);
      return NextResponse.json(
        { error: 'DB 조회 실패', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!rows?.length) {
      return NextResponse.json({
        success: true,
        message: '삭제할 Cloudinary 자산이 없습니다.',
        deleted: 0,
        updated: 0,
        errors: [],
      });
    }

    const errors: { id: string; publicId: string; message: string }[] = [];
    let deleted = 0;

    for (const row of rows) {
      const publicId = row.cloudinary_public_id as string;
      const ok = await deleteFromCloudinary(publicId);
      if (ok) {
        deleted++;
      } else {
        errors.push({
          id: row.id,
          publicId,
          message: 'Cloudinary destroy 실패 또는 예외',
        });
      }
    }

    // 삭제 시도한 모든 레코드에 대해 DB에서 cloudinary 필드 null 처리
    // (삭제 실패한 항목도 URL이 깨질 수 있으므로 null로 정리)
    const ids = rows.map((r) => r.id);
    const { error: updateError } = await supabase
      .from('memory_vault')
      .update({
        cloudinary_url: null,
        cloudinary_public_id: null,
      })
      .in('id', ids);

    if (updateError) {
      console.error('Cloudinary cleanup DB update error:', updateError);
      return NextResponse.json({
        success: false,
        message: 'Cloudinary 삭제는 완료했으나 DB 업데이트 실패',
        deleted,
        updated: 0,
        errors: errors.map((e) => e.message),
        updateError: updateError.message,
      });
    }

    return NextResponse.json({
      success: true,
      message: `${deleted}개 Cloudinary 자산 삭제, ${ids.length}개 레코드 DB 정리 완료`,
      deleted,
      updated: ids.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (error: unknown) {
    console.error('Cloudinary cleanup error:', error);
    return NextResponse.json(
      {
        error: '처리 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
