import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { DB_TABLES } from '@/lib/db-table-names';
import { clampLocationOvalFocusY } from '@/lib/album-photo-focus';

/**
 * PATCH /api/photos/focus-y
 * 그룹 멤버가 앨범 사진의 focus_y를 1회 저장 (이미 있으면 409).
 * RLS는 uploader만 UPDATE 가능하므로 service role로 focus_y만 갱신.
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json().catch(() => ({}));
    const photoId = body?.photoId as string | undefined;
    const groupId = body?.groupId as string | undefined;
    const focusYRaw = body?.focusY;

    if (!photoId || typeof photoId !== 'string') {
      return NextResponse.json({ error: 'photoId가 필요합니다.' }, { status: 400 });
    }
    if (!groupId || typeof groupId !== 'string') {
      return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
    }
    if (typeof focusYRaw !== 'number' || !Number.isFinite(focusYRaw)) {
      return NextResponse.json({ error: 'focusY가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const focusY = clampLocationOvalFocusY(focusYRaw);
    const supabase = getSupabaseServerClient();

    const { data: row, error: fetchError } = await supabase
      .from(DB_TABLES.FAMILY_ALBUM_ITEMS)
      .select('id, group_id, focus_y')
      .eq('id', photoId)
      .eq('group_id', groupId)
      .maybeSingle();

    if (fetchError || !row) {
      return NextResponse.json({ error: '사진을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (row.focus_y != null) {
      return NextResponse.json(
        { error: '이미 위치가 저장되어 있습니다.', focusY: row.focus_y },
        { status: 409 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from(DB_TABLES.FAMILY_ALBUM_ITEMS)
      .update({ focus_y: focusY })
      .eq('id', photoId)
      .eq('group_id', groupId)
      .is('focus_y', null)
      .select('id, focus_y')
      .maybeSingle();

    if (updateError) {
      console.error('[photos/focus-y] update error', updateError);
      return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json(
        { error: '이미 위치가 저장되어 있습니다.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, focusY: updated.focus_y });
  } catch (err) {
    console.error('[photos/focus-y]', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
