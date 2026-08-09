import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { NOTIFIABLE_WIDGET_KEYS, isNotifiableWidgetKey } from '@/lib/notifications/types';

/** GET/PUT: 위젯별 알림 수신 설정 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId) {
      return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('widget_key, push_enabled, inapp_enabled, updated_at')
      .eq('user_id', user.id)
      .eq('group_id', groupId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const byKey = new Map((data || []).map((row) => [row.widget_key, row]));
    const preferences = NOTIFIABLE_WIDGET_KEYS.map((widgetKey) => {
      const row = byKey.get(widgetKey);
      return {
        widget_key: widgetKey,
        push_enabled: row ? row.push_enabled !== false : true,
        inapp_enabled: row ? row.inapp_enabled !== false : true,
        updated_at: row?.updated_at ?? null,
      };
    });

    return NextResponse.json({ success: true, data: preferences });
  } catch (error) {
    console.error('GET /api/notifications/preferences:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '조회 실패' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json().catch(() => ({}));
    const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
    const preferences = Array.isArray(body.preferences) ? body.preferences : null;

    if (!groupId || !preferences) {
      return NextResponse.json({ error: 'groupId와 preferences가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const now = new Date().toISOString();
    const rows = [];
    for (const pref of preferences) {
      const widgetKey = typeof pref.widget_key === 'string' ? pref.widget_key : '';
      if (!isNotifiableWidgetKey(widgetKey)) continue;
      rows.push({
        user_id: user.id,
        group_id: groupId,
        widget_key: widgetKey,
        push_enabled: pref.push_enabled !== false,
        inapp_enabled: pref.inapp_enabled !== false,
        updated_at: now,
      });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: '유효한 preferences가 없습니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from('notification_preferences').upsert(rows, {
      onConflict: 'user_id,group_id,widget_key',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/notifications/preferences:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '저장 실패' },
      { status: 500 },
    );
  }
}
