import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/api-guards';
import { CURRENT_APP_ID } from '@/lib/apps';
import { BillingMessageError, ensureOwnerBetaPromoCode, redeemBetaPromoCode } from '@/lib/billing-promo';

export const dynamic = 'force-dynamic';

/** 베타 오너 화면에 보여줄 그룹 할인코드. 용량은 바꾸지 않는다. */
export async function GET(request: NextRequest) {
  const authResult = await requireAuthUser(request);
  if (authResult instanceof NextResponse) return authResult;

  const groupId = request.nextUrl.searchParams.get('groupId')?.trim() ?? '';
  if (!groupId) {
    return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
  }

  try {
    const result = await ensureOwnerBetaPromoCode({
      appId: CURRENT_APP_ID,
      userId: authResult.user.id,
      groupId,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return promoErrorResponse(error, '할인코드를 조회하지 못했습니다.');
  }
}

/** 코드 확인. 성공해도 용량은 바뀌지 않고 50% 자격만 남는다. */
export async function POST(request: NextRequest) {
  const authResult = await requireAuthUser(request);
  if (authResult instanceof NextResponse) return authResult;

  let body: { groupId?: string; code?: string };
  try {
    body = (await request.json()) as { groupId?: string; code?: string };
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const groupId = body.groupId?.trim() ?? '';
  const code = body.code?.trim() ?? '';
  if (!groupId || !code) {
    return NextResponse.json({ error: 'groupId와 code가 필요합니다.' }, { status: 400 });
  }

  try {
    const result = await redeemBetaPromoCode({
      appId: CURRENT_APP_ID,
      userId: authResult.user.id,
      groupId,
      code,
    });
    return NextResponse.json({ success: true, quotaChanged: false, ...result });
  } catch (error) {
    return promoErrorResponse(error, '할인코드를 확인하지 못했습니다.');
  }
}

function promoErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const code = error instanceof BillingMessageError ? error.code : undefined;
  const status = code === 'promo_owner_view' || code === 'promo_owner_use' || code === 'not_beta' ? 403 : 400;
  return NextResponse.json(code ? { error: message, code } : { error: message }, { status });
}
