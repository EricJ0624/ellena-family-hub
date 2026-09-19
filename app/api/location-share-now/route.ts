import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { notifyFamily } from '@/lib/notifications/notify';

/**
 * 「나여기」— 내 GPS를 저장하고 같은 그룹 멤버와 accepted 공유를 즉시 연다.
 * 기존 /api/location-request · /api/location-approve 경로는 수정하지 않는다.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    '필수 환경 변수가 설정되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인해주세요.',
  );
}

const SUPABASE_URL: string = supabaseUrl;
const SUPABASE_SERVICE_KEY: string = supabaseServiceKey;

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
    const latitude = body.latitude != null ? Number(body.latitude) : NaN;
    const longitude = body.longitude != null ? Number(body.longitude) : NaN;
    const address = typeof body.address === 'string' ? body.address : '';

    if (!groupId) {
      return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: '유효한 latitude, longitude가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error: locationError } = await supabase.from('user_locations').upsert(
      {
        user_id: user.id,
        group_id: groupId,
        latitude,
        longitude,
        address: address || null,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (locationError) {
      console.error('나여기 위치 저장 오류:', locationError);
      return NextResponse.json(
        { error: '위치 저장에 실패했습니다.', details: locationError.message },
        { status: 500 },
      );
    }

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
      .eq('group_id', groupId);

    if (membershipError) {
      console.error('나여기 memberships 조회 오류:', membershipError);
      return NextResponse.json(
        { error: '멤버 확인 중 오류가 발생했습니다.', details: membershipError.message },
        { status: 500 },
      );
    }

    const targetIdSet = new Set<string>();
    for (const row of membershipRows ?? []) {
      if (row.user_id) targetIdSet.add(String(row.user_id));
    }
    if (groupData.owner_id) targetIdSet.add(String(groupData.owner_id));
    targetIdSet.delete(user.id);

    const targetIds = Array.from(targetIdSet);
    if (targetIds.length === 0) {
      return NextResponse.json({
        success: true,
        sharedWith: [],
        message: '공유할 그룹 멤버가 없습니다.',
      });
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const newlyNotified: string[] = [];
    const sharedWith: string[] = [];

    for (const targetId of targetIds) {
      const { data: acceptedRows } = await supabase
        .from('location_requests')
        .select('id')
        .eq('group_id', groupId)
        .eq('status', 'accepted')
        .or(
          `and(requester_id.eq.${user.id},target_id.eq.${targetId}),and(requester_id.eq.${targetId},target_id.eq.${user.id})`,
        )
        .limit(1);

      if (acceptedRows && acceptedRows.length > 0) {
        sharedWith.push(targetId);
        continue;
      }

      const { data: pendingWhereRows } = await supabase
        .from('location_requests')
        .select('id, request_type')
        .eq('group_id', groupId)
        .eq('status', 'pending')
        .eq('request_type', 'where')
        .or(
          `and(requester_id.eq.${user.id},target_id.eq.${targetId}),and(requester_id.eq.${targetId},target_id.eq.${user.id})`,
        )
        .limit(1);

      if (pendingWhereRows && pendingWhereRows.length > 0) {
        const pendingId = pendingWhereRows[0].id;
        const { error: acceptError } = await supabase
          .from('location_requests')
          .update({ status: 'accepted', expires_at: expiresAt })
          .eq('id', pendingId)
          .eq('group_id', groupId);

        if (acceptError) {
          console.error('나여기 pending 승인 오류:', acceptError, pendingId);
          continue;
        }
        sharedWith.push(targetId);
        newlyNotified.push(targetId);
        continue;
      }

      const { error: insertError } = await supabase
        .from('location_requests')
        .insert({
          requester_id: user.id,
          target_id: targetId,
          group_id: groupId,
          status: 'accepted',
          request_type: 'where',
          expires_at: expiresAt,
        });

      if (insertError) {
        console.error('나여기 공유 생성 오류:', insertError, targetId);
        continue;
      }

      sharedWith.push(targetId);
      newlyNotified.push(targetId);
    }

    if (newlyNotified.length > 0) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nickname, email')
          .eq('id', user.id)
          .single();
        const sharerName = profile?.nickname || profile?.email || '가족';

        await notifyFamily({
          groupId,
          actorUserId: user.id,
          recipientUserIds: newlyNotified,
          widgetKey: 'location',
          eventType: 'LOCATION_REQUEST',
          title: '📍 나여기',
          body: `${sharerName}님이 위치를 공유했습니다.`,
          url: '/dashboard?focus=location',
          entityId: user.id,
          tag: `im-here-${user.id}`,
        });
      } catch (notifyError) {
        console.warn('나여기 알림 오류 (공유는 성공):', notifyError);
      }
    }

    return NextResponse.json({
      success: true,
      sharedWith,
      newlySharedCount: newlyNotified.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('나여기 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: errorMessage },
      { status: 500 },
    );
  }
}
