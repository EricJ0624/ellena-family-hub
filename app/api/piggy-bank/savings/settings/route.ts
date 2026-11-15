import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupAdmin } from '@/lib/api-guards';
import {
  computeNextInterestOn,
  getPiggyAccountForUserIfExists,
  getPiggySavingsAccountById,
} from '@/lib/piggy-bank';

function parseNonNegInt(raw: unknown, max: number): number | null {
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(value as number)) return null;
  const n = Math.floor(value as number);
  if (n < 0 || n > max) return null;
  return n;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const {
      groupId,
      childId,
      savingsAccountId,
      name,
      bankName,
      accountNumber,
      accountLabel,
      annualInterestRateBps,
      interestDay,
      taxRateBps,
      nextInterestOn,
    } = body ?? {};

    if (!groupId || !childId || !savingsAccountId) {
      return NextResponse.json(
        { error: 'groupId, childId, savingsAccountId가 필요합니다.' },
        { status: 400 },
      );
    }

    const adminCheck = await requireGroupAdmin(user.id, groupId);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const rateBps = parseNonNegInt(annualInterestRateBps, 100000);
    const day = parseNonNegInt(interestDay, 28);
    const taxBps = parseNonNegInt(taxRateBps, 10000);
    if (rateBps === null || day === null || day < 1 || taxBps === null) {
      return NextResponse.json({ error: '이율·지급일·세율 값이 올바르지 않습니다.' }, { status: 400 });
    }

    const piggy = await getPiggyAccountForUserIfExists(groupId, childId);
    if (!piggy) {
      return NextResponse.json({ error: '저금통이 없습니다. 먼저 저금통을 만들어 주세요.' }, { status: 400 });
    }

    const savings = await getPiggySavingsAccountById(groupId, String(savingsAccountId));
    if (!savings || savings.user_id !== childId) {
      return NextResponse.json({ error: '은행계좌를 찾을 수 없습니다.' }, { status: 404 });
    }

    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();

    let nextOn: string;
    if (typeof nextInterestOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(nextInterestOn.trim())) {
      nextOn = nextInterestOn.trim();
    } else {
      nextOn = computeNextInterestOn(day);
    }

    const patch: Record<string, unknown> = {
      annual_interest_rate_bps: rateBps,
      interest_day: day,
      tax_rate_bps: taxBps,
      next_interest_on: nextOn,
      updated_at: now,
    };
    if (typeof name === 'string') patch.name = name.trim().slice(0, 80) || savings.name;
    if (typeof bankName === 'string') patch.bank_name = bankName.trim().slice(0, 80);
    if (typeof accountNumber === 'string') patch.account_number = accountNumber.trim().slice(0, 64);
    if (typeof accountLabel === 'string') {
      patch.account_label = accountLabel.trim().slice(0, 40) || 'Saving';
    }

    const { data, error } = await supabase
      .from('piggy_savings_accounts')
      .update(patch)
      .eq('id', savings.id)
      .select(
        'id, group_id, user_id, name, bank_name, account_number, account_label, balance, currency, annual_interest_rate_bps, interest_day, next_interest_on, tax_rate_bps',
      )
      .single();

    if (error || !data) {
      throw error || new Error('은행계좌 설정 저장에 실패했습니다.');
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '은행계좌 설정 저장에 실패했습니다.';
    console.error('Piggy savings settings 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
