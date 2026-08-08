import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin, requireGroupMember } from '@/lib/api-guards';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Soft-delete a group scene (is_active=false).
 * Allowed for uploader or group admin/owner.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: '장면 ID가 필요합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: scene, error: loadError } = await supabase
      .from('picture_find_scenes')
      .select('id, scope, group_id, created_by, is_active')
      .eq('id', id)
      .maybeSingle();

    if (loadError || !scene) {
      return NextResponse.json({ error: '장면을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (scene.scope !== 'group' || !scene.group_id) {
      return NextResponse.json({ error: '기본 장면은 삭제할 수 없습니다.' }, { status: 403 });
    }

    const memberCheck = await requireGroupMember(user.id, scene.group_id);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const isUploader = scene.created_by === user.id;
    if (!isUploader) {
      const adminCheck = await requireGroupAdmin(user.id, scene.group_id);
      if (adminCheck instanceof NextResponse) return adminCheck;
    }

    if (!scene.is_active) {
      return NextResponse.json({ success: true, data: { id: scene.id, removed: true } });
    }

    const { error: updateError } = await supabase
      .from('picture_find_scenes')
      .update({ is_active: false })
      .eq('id', scene.id);

    if (updateError) {
      console.error('[picture-find/scenes] delete error:', updateError);
      return NextResponse.json({ error: '장면 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { id: scene.id, removed: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '장면 삭제 중 오류가 발생했습니다.';
    console.error('[picture-find/scenes] DELETE', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
