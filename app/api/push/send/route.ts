// Web Push API — 위치 요청 등 호환용 thin wrapper (인증·그룹 멤버십 필수)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { notifyFamily } from '@/lib/notifications/notify';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('필수 환경 변수가 설정되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인해주세요.');
}

const SUPABASE_URL: string = supabaseUrl;
const SUPABASE_SERVICE_KEY: string = supabaseServiceKey;

async function assertUserInGroup(
  targetUserId: string,
  groupId: string
): Promise<true | NextResponse> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: groupData, error: groupError } = await supabase
    .from('groups')
    .select('owner_id')
    .eq('id', groupId)
    .single();

  if (groupError || !groupData) {
    return NextResponse.json({ error: '그룹을 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data: membershipRows, error: membershipError } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', targetUserId)
    .limit(1);

  if (membershipError) {
    console.error('push/send memberships 조회 오류:', membershipError);
    return NextResponse.json(
      { error: '멤버 확인 중 오류가 발생했습니다.', details: membershipError.message },
      { status: 500 }
    );
  }

  const isMember = membershipRows != null && membershipRows.length > 0;
  const isTargetOwner =
    !!groupData.owner_id &&
    String(groupData.owner_id).toLowerCase() === String(targetUserId).toLowerCase();

  if (!isMember && !isTargetOwner) {
    return NextResponse.json(
      { error: '대상 사용자는 해당 그룹의 멤버가 아닙니다.' },
      { status: 403 }
    );
  }

  return true;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { targetUserId, requesterName, requestId, requestType, groupId } = await request.json();

    if (!targetUserId || !requesterName || !requestId || !groupId) {
      return NextResponse.json(
        { error: 'targetUserId, requesterName, requestId, groupId가 필요합니다.' },
        { status: 400 },
      );
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const targetCheck = await assertUserInGroup(targetUserId, groupId);
    if (targetCheck instanceof NextResponse) return targetCheck;

    const isComeHere = requestType === 'come_here';
    const title = isComeHere ? '📍 일루와 요청' : '📍 위치 요청';
    const body = isComeHere
      ? `${requesterName}님이 당신에게 일루와를 요청했습니다.`
      : `${requesterName}님이 당신의 위치를 요청했습니다.`;
    const url = '/dashboard?locationRequest=' + requestId;

    const result = await notifyFamily({
      groupId,
      actorUserId: user.id,
      recipientUserIds: [targetUserId],
      widgetKey: 'location',
      eventType: 'LOCATION_REQUEST',
      title,
      body,
      url,
      entityId: requestId,
      payload: { requestId, requestType },
      tag: requestId,
    });

    return NextResponse.json({
      success: true,
      message:
        result.pushSent > 0
          ? '푸시 알림이 전송되었습니다.'
          : '요청은 처리되었습니다(토큰 없거나 설정 off).',
      result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('Web Push 알림 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: errorMessage },
      { status: 500 },
    );
  }
}
