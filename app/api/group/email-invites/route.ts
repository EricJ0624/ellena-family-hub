import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin } from '@/lib/api-guards';
import {
  GROUP_EMAIL_INVITE_ERROR,
  normalizeInviteEmail,
  GROUP_EMAIL_INVITE_EMAIL_REGEX,
} from '@/lib/group-email-invite';

const inviteRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 15;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = inviteRateLimit.get(key);
  if (!entry) {
    inviteRateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (now >= entry.resetAt) {
    inviteRateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

async function findRegisteredUserIdByEmail(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  email: string,
): Promise<string | null> {
  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id, email')
    .ilike('email', email);

  if (!profileError && profileRows?.length) {
    const exact = profileRows.find(
      (row) => typeof row.email === 'string' && row.email.trim().toLowerCase() === email,
    );
    if (exact?.id) return exact.id;
  }

  let page = 1;
  const perPage = 200;
  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error || !data.users.length) break;
    const match = data.users.find(
      (u) => typeof u.email === 'string' && u.email.trim().toLowerCase() === email,
    );
    if (match?.id) return match.id;
    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

/**
 * 그룹 관리자: 등록된 사용자 이메일로 초대
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json().catch(() => ({}));
    const groupId = typeof body?.group_id === 'string' ? body.group_id.trim() : '';
    const email = normalizeInviteEmail(typeof body?.email === 'string' ? body.email : '');

    if (!groupId) {
      return NextResponse.json({ error: '그룹 ID가 필요합니다.' }, { status: 400 });
    }
    if (!email || !GROUP_EMAIL_INVITE_EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: '유효한 이메일을 입력해 주세요.', code: GROUP_EMAIL_INVITE_ERROR.INVALID_EMAIL },
        { status: 400 },
      );
    }

    const ip = getClientIp(request);
    if (!checkRateLimit(`${ip}:${user.id}:${groupId}`)) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429 },
      );
    }

    const adminCheck = await requireGroupAdmin(user.id, groupId);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const supabase = getSupabaseServerClient();
    const inviteeUserId = await findRegisteredUserIdByEmail(supabase, email);
    if (!inviteeUserId) {
      return NextResponse.json(
        {
          error: '등록된 사용자가 아닙니다. 초대 코드로 가입을 안내해 주세요.',
          code: GROUP_EMAIL_INVITE_ERROR.USER_NOT_REGISTERED,
        },
        { status: 404 },
      );
    }

    if (inviteeUserId === user.id) {
      return NextResponse.json(
        { error: '본인은 초대할 수 없습니다.', code: GROUP_EMAIL_INVITE_ERROR.CANNOT_INVITE_SELF },
        { status: 400 },
      );
    }

    const { data: membership } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('user_id', inviteeUserId)
      .maybeSingle();

    const { data: ownedGroup } = await supabase
      .from('groups')
      .select('id')
      .eq('id', groupId)
      .eq('owner_id', inviteeUserId)
      .maybeSingle();

    if (membership || ownedGroup) {
      return NextResponse.json(
        { error: '이미 이 그룹에 소속된 사용자입니다.', code: GROUP_EMAIL_INVITE_ERROR.ALREADY_MEMBER },
        { status: 409 },
      );
    }

    const { data: existingPending } = await supabase
      .from('group_email_invites')
      .select('id')
      .eq('group_id', groupId)
      .eq('invitee_user_id', inviteeUserId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingPending?.id) {
      return NextResponse.json(
        {
          success: true,
          already_pending: true,
          invite_id: existingPending.id,
          message: '이미 초대를 보냈습니다. 상대방이 로그인하면 알림이 표시됩니다.',
        },
        { status: 200 },
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from('group_email_invites')
      .insert({
        group_id: groupId,
        invitee_user_id: inviteeUserId,
        invitee_email: email,
        invited_by: user.id,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('group_email_invites insert error:', insertError);
      return NextResponse.json({ error: '초대 저장에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      invite_id: inserted.id,
      message: '초대를 보냈습니다. 상대방이 로그인하면 알림이 표시됩니다.',
    });
  } catch (err) {
    console.error('group email invite POST error:', err);
    return NextResponse.json({ error: '초대 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
