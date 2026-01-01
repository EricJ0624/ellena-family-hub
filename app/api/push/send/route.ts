// Web Push API를 사용한 푸시 알림 전송
// 위치 요청 시 상대방에게 푸시 알림을 보냅니다 (Supabase 사용)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Node.js 런타임 사용 (web-push는 Node.js 네이티브 모듈이므로 필요)
export const runtime = 'nodejs';

// 동적 import로 web-push 로드
let webpush: typeof import('web-push');
async function getWebPush() {
  if (!webpush) {
    webpush = await import('web-push');
  }
  return webpush;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:your-email@example.com';

// Web Push 푸시 알림 전송
export async function POST(request: NextRequest) {
  try {
    const { targetUserId, requesterName, requestId } = await request.json();

    if (!targetUserId || !requesterName || !requestId) {
      return NextResponse.json(
        { error: 'targetUserId, requesterName, requestId가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID 키가 설정되지 않았습니다.');
      return NextResponse.json(
        { error: 'VAPID 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // web-push 모듈 동적 로드 및 VAPID 키 설정
    const webpush = await getWebPush();
    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

    // Supabase에서 대상 사용자의 Push 토큰 조회
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: pushTokenData, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', targetUserId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (tokenError || !pushTokenData) {
      console.warn('Push 토큰을 찾을 수 없습니다:', tokenError);
      // 토큰이 없어도 성공으로 처리 (앱이 켜져있으면 Realtime으로 처리됨)
      return NextResponse.json({
        success: true,
        message: 'Push 토큰이 없지만 요청은 생성되었습니다.'
      });
    }

    const pushSubscription = JSON.parse(pushTokenData.token);

    // 푸시 알림 페이로드
    const payload = JSON.stringify({
      title: '📍 위치 요청',
      body: `${requesterName}님이 당신의 위치를 요청했습니다.`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: requestId,
      data: {
        type: 'LOCATION_REQUEST',
        requestId: requestId,
        url: '/dashboard?locationRequest=' + requestId
      }
    });

    try {
      // Web Push API로 푸시 알림 전송
      await webpush.sendNotification(pushSubscription, payload);
      console.log('Web Push 알림 전송 성공');

      return NextResponse.json({
        success: true,
        message: '푸시 알림이 전송되었습니다.'
      });
    } catch (pushError: any) {
      console.error('Web Push 알림 전송 실패:', pushError);
      
      // 구독이 만료되었거나 유효하지 않은 경우 토큰 비활성화
      if (pushError.statusCode === 410 || pushError.statusCode === 404) {
        await supabase
          .from('push_tokens')
          .update({ is_active: false })
          .eq('user_id', targetUserId)
          .eq('token', pushTokenData.token);
      }

      return NextResponse.json(
        { error: '푸시 알림 전송에 실패했습니다.', details: pushError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Web Push 알림 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

