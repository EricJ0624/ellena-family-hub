import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { DEFAULT_WIDGET_CONFIGS } from '@/lib/widgets/types';

/** POST: enable travel_diary widget for group (any member; server role upsert) */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json().catch(() => ({}));
    const groupId = (body.groupId ?? request.nextUrl.searchParams.get('groupId')) as string | undefined;
    if (!groupId) {
      return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const draft = DEFAULT_WIDGET_CONFIGS.find((c) => c.widget_key === 'travel_diary');
    if (!draft) {
      return NextResponse.json({ error: 'travel_diary 설정을 찾을 수 없습니다.' }, { status: 500 });
    }

    const supabase = getSupabaseServerClient();
    const { data: existing } = await supabase
      .from('widget_configs')
      .select('id')
      .eq('group_id', groupId)
      .eq('widget_key', 'travel_diary')
      .maybeSingle();

    const row = {
      group_id: groupId,
      widget_key: 'travel_diary',
      is_enabled: true,
      display_order: draft.display_order,
      size: draft.size,
      col_span: draft.colSpan,
      row_span: draft.rowSpan,
      min_w: draft.minW,
      min_h: draft.minH,
      priority: draft.priority,
      layout_x: draft.layoutX,
      layout_y: draft.layoutY,
      layout_w: draft.layoutW,
      layout_h: draft.layoutH,
      layout_version: draft.layoutVersion,
      layout_portrait_x: draft.layoutPortraitX,
      layout_portrait_y: draft.layoutPortraitY,
      layout_portrait_w: draft.layoutPortraitW,
      layout_portrait_h: draft.layoutPortraitH,
      layout_landscape_x: draft.layoutLandscapeX,
      layout_landscape_y: draft.layoutLandscapeY,
      layout_landscape_w: draft.layoutLandscapeW,
      layout_landscape_h: draft.layoutLandscapeH,
    };

    if (existing?.id) {
      const { error } = await supabase
        .from('widget_configs')
        .update({ is_enabled: true })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('widget_configs').insert(row);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error('POST enable-travel-diary:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '서버 오류' },
      { status: 500 },
    );
  }
}
