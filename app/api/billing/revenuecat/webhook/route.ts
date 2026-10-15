import { NextRequest, NextResponse } from 'next/server';
import {
  applyRevenueCatWebhook,
  billingWebhookAuthorized,
  type RevenueCatWebhookBody,
} from '@/lib/billing-apply-webhook';

export const dynamic = 'force-dynamic';

/**
 * RevenueCat 웹훅. 클라이언트 결제 성공 메시지는 용량을 바꾸지 않는다.
 * BILLING_ACCEPT_LIVE_STORE 가 true가 아니면 Play 스토어 이벤트는 용량을 바꾸지 않는다.
 */
export async function POST(request: NextRequest) {
  if (!process.env.REVENUECAT_WEBHOOK_AUTHORIZATION?.trim()) {
    return NextResponse.json({ error: '웹훅 인증값이 없습니다.' }, { status: 503 });
  }
  if (!billingWebhookAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: '웹훅 인증에 실패했습니다.' }, { status: 401 });
  }

  let body: RevenueCatWebhookBody;
  try {
    body = (await request.json()) as RevenueCatWebhookBody;
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  try {
    const outcome = await applyRevenueCatWebhook(body);
    return NextResponse.json({ result: outcome.result }, { status: outcome.status });
  } catch (error) {
    console.error('RevenueCat 웹훅 처리 오류:', error);
    return NextResponse.json({ error: '웹훅 처리에 실패했습니다.' }, { status: 500 });
  }
}
