import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient, deleteFromS3 } from '@/lib/api-helpers';
import { requireAuthUser } from '@/lib/api-guards';

/**
 * 그룹 소유자 전용: 가족(그룹) 영구 삭제
 * — memory_vault S3 객체 삭제 후 DB에서 그룹 삭제(CASCADE)
 * — 시스템 관리자용 /api/admin/groups/delete 와 동일한 데이터 정리, 권한만 소유자로 제한
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json().catch(() => ({}));
    const { groupId } = body as { groupId?: string };

    if (!groupId) {
      return NextResponse.json({ error: '그룹 ID가 필요합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data: groupRow, error: groupFetchError } = await supabase
      .from('groups')
      .select('id, owner_id')
      .eq('id', groupId)
      .single();

    if (groupFetchError || !groupRow) {
      return NextResponse.json({ error: '그룹을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (groupRow.owner_id !== user.id) {
      return NextResponse.json(
        { error: '그룹 소유자만 가족을 삭제할 수 있습니다.' },
        { status: 403 }
      );
    }

    const { data: photos } = await supabase.from('memory_vault').select('id, s3_key').eq('group_id', groupId);

    if (photos && photos.length > 0) {
      const deletePromises: Promise<boolean>[] = [];
      for (const photo of photos) {
        if (photo.s3_key) {
          deletePromises.push(deleteFromS3(photo.s3_key));
        }
      }
      await Promise.all(deletePromises);
    }

    const { error: deleteError } = await supabase.from('groups').delete().eq('id', groupId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: '그룹이 삭제되었습니다.',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '그룹 삭제 중 오류가 발생했습니다.';
    console.error('그룹 삭제(소유자) 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
