import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser } from '@/lib/api-guards';
import type { PendingGroupEmailInvite } from '@/lib/group-email-invite';
import { getGroupDisplayNameRaw } from '@/lib/group-display-name';

/**
 * 로그인 사용자의 pending 이메일 초대 목록
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const supabase = getSupabaseServerClient();
    const nowIso = new Date().toISOString();

    const { data: rows, error } = await supabase
      .from('group_email_invites')
      .select('id, group_id, invited_by')
      .eq('invitee_user_id', user.id)
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('group_email_invites mine GET error:', error);
      return NextResponse.json({ error: '초대 목록 조회에 실패했습니다.' }, { status: 500 });
    }

    if (!rows?.length) {
      return NextResponse.json({ success: true, invites: [] });
    }

    const groupIds = [...new Set(rows.map((r) => r.group_id))];
    const inviterIds = [...new Set(rows.map((r) => r.invited_by).filter(Boolean))];

    const [{ data: groups }, { data: profiles }] = await Promise.all([
      supabase
        .from('groups')
        .select('id, name, family_name, display_name_pending, title_style')
        .in('id', groupIds),
      inviterIds.length
        ? supabase.from('profiles').select('id, nickname, email').in('id', inviterIds)
        : Promise.resolve({ data: [] as { id: string; nickname: string | null; email: string | null }[] }),
    ]);

    const groupById = new Map((groups ?? []).map((g) => [g.id, g]));
    const inviterNameById = new Map<string, string | null>();
    (profiles ?? []).forEach((p) => {
      inviterNameById.set(
        p.id,
        (p.nickname?.trim() || p.email?.trim() || null) as string | null,
      );
    });

    const invites: PendingGroupEmailInvite[] = rows.map((row) => {
      const group = groupById.get(row.group_id) ?? null;
      return {
        id: row.id,
        group_id: row.group_id,
        group_name: getGroupDisplayNameRaw(group) || group?.name || '',
        invited_by_name: inviterNameById.get(row.invited_by) ?? null,
      };
    });

    return NextResponse.json({ success: true, invites });
  } catch (err) {
    console.error('group email invites mine GET error:', err);
    return NextResponse.json({ error: '초대 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
