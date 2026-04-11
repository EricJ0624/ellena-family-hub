import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin } from '@/lib/api-guards';
import { isAllowedCurrency, normalizeCurrencyCode } from '@/lib/currencies';

/** PATCH: 그룹 Piggy Bank 통화 변경 (관리자만). piggy_bank_accounts 동기화. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { groupId } = await params;
    if (!groupId) {
      return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
    }

    const adminCheck = await requireGroupAdmin(user.id, groupId);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const body = await request.json().catch(() => ({}));
    const raw = (body as { currency?: string }).currency;
    const code = normalizeCurrencyCode(raw);
    if (!code || !isAllowedCurrency(code)) {
      return NextResponse.json({ error: '유효하지 않은 통화 코드입니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();

    const { error: groupError } = await supabase
      .from('groups')
      .update({ piggy_currency: code, updated_at: now })
      .eq('id', groupId);

    if (groupError) {
      console.error('groups piggy_currency update:', groupError);
      return NextResponse.json(
        { error: '그룹 통화 저장에 실패했습니다. DB에 piggy_currency 컬럼이 있는지 확인하세요.' },
        { status: 500 }
      );
    }

    const { error: accountsError } = await supabase
      .from('piggy_bank_accounts')
      .update({ currency: code, updated_at: now })
      .eq('group_id', groupId);

    if (accountsError) {
      console.error('piggy_bank_accounts currency sync:', accountsError);
      return NextResponse.json({ error: '저금통 통화 동기화에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { currency: code } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '서버 오류';
    console.error('PATCH piggy-currency:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
