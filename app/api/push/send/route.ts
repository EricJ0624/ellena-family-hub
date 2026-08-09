// Web Push API — 위치 요청 등 호환용 thin wrapper
import { NextRequest, NextResponse } from 'next/server';
import { notifyFamily } from '@/lib/notifications/notify';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { targetUserId, requesterName, requestId, requestType, groupId } = await request.json();

    if (!targetUserId || !requesterName || !requestId) {
      return NextResponse.json(
        { error: 'targetUserId, requesterName, requestId가 필요합니다.' },
        { status: 400 },
      );
    }

    const isComeHere = requestType === 'come_here';
    const title = isComeHere ? '📍 일루와 요청' : '📍 위치 요청';
    const body = isComeHere
      ? `${requesterName}님이 당신에게 일루와를 요청했습니다.`
      : `${requesterName}님이 당신의 위치를 요청했습니다.`;
    const url = '/dashboard?locationRequest=' + requestId;

    // groupId가 없으면 인앱 기록 없이 푸시만 (레거시 호환) — location-request는 groupId 전달
    if (groupId) {
      const result = await notifyFamily({
        groupId,
        actorUserId: null,
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
    }

    const { sendWebPushToUser } = await import('@/lib/notifications/send-web-push');
    const pushResult = await sendWebPushToUser(targetUserId, {
      title,
      body,
      tag: requestId,
      data: {
        type: 'LOCATION_REQUEST',
        requestId,
        url,
      },
    });

    if (pushResult.reason === 'no_vapid') {
      return NextResponse.json({ error: pushResult.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: pushResult.message,
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
