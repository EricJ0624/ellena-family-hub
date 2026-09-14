import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientForAccessToken, getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser } from '@/lib/api-guards';
import { CURRENT_APP_ID } from '@/lib/apps';
import { extractBearerToken } from '@/lib/group-short-invite';

/** GET: 요청자 본인의 pending / 최근 처리 결과 + 미확인 결과 알림 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Auth token required' }, { status: 401 });
    }

    const userClient = getSupabaseClientForAccessToken(token);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: pendingRows, error: pendingErr }, { data: resolvedRows, error: resolvedErr }] =
      await Promise.all([
        userClient
          .from('group_join_requests')
          .select('id, group_id, status, created_at, resolved_at')
          .eq('requester_user_id', user.id)
          .eq('app_id', CURRENT_APP_ID)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5),
        userClient
          .from('group_join_requests')
          .select('id, group_id, status, created_at, resolved_at')
          .eq('requester_user_id', user.id)
          .eq('app_id', CURRENT_APP_ID)
          .in('status', ['approved', 'rejected'])
          .gte('resolved_at', since)
          .order('resolved_at', { ascending: false })
          .limit(5),
      ]);

    if (pendingErr) {
      console.error('mine join-requests pending:', pendingErr);
      return NextResponse.json({ error: '조회에 실패했습니다.' }, { status: 500 });
    }
    if (resolvedErr) {
      console.error('mine join-requests resolved:', resolvedErr);
      return NextResponse.json({ error: '조회에 실패했습니다.' }, { status: 500 });
    }

    const service = getSupabaseServerClient();
    const { data: unreadResolved } = await service
      .from('notifications')
      .select('id, group_id, entity_id, title, body, payload, created_at, read_at')
      .eq('recipient_user_id', user.id)
      .eq('event_type', 'GROUP_JOIN_RESOLVED')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(10);

    const groupIds = Array.from(
      new Set(
        [
          ...(pendingRows || []).map((r) => String(r.group_id)),
          ...(resolvedRows || []).map((r) => String(r.group_id)),
          ...(unreadResolved || []).map((n) => String(n.group_id)),
        ].filter(Boolean),
      ),
    );

    let nameByGroup = new Map<string, string | null>();
    if (groupIds.length > 0) {
      const { data: groups } = await service
        .from('groups')
        .select('id, name, family_name')
        .in('id', groupIds)
        .eq('app_id', CURRENT_APP_ID);
      nameByGroup = new Map(
        (groups || []).map((g) => [
          String(g.id),
          (typeof g.family_name === 'string' && g.family_name.trim()) ||
            (typeof g.name === 'string' && g.name.trim()) ||
            null,
        ]),
      );
    }

    const withName = <T extends { group_id: string }>(rows: T[] | null) =>
      (rows || []).map((r) => ({
        ...r,
        group_name: nameByGroup.get(String(r.group_id)) ?? null,
      }));

    return NextResponse.json({
      success: true,
      data: {
        pending: withName(pendingRows),
        recentResolved: withName(resolvedRows),
        unreadResolvedNotifications: (unreadResolved || []).map((n) => ({
          ...n,
          group_name: nameByGroup.get(String(n.group_id)) ?? null,
        })),
      },
    });
  } catch (err) {
    console.error('GET join-requests/mine:', err);
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
