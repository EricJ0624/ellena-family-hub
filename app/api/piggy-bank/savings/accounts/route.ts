import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireGroupAdmin } from '@/lib/api-guards';
import {
  createPiggySavingsAccount,
  getPiggyAccountForUserIfExists,
  listPiggySavingsAccounts,
  MAX_PIGGY_SAVINGS_ACCOUNTS,
} from '@/lib/piggy-bank';

/** 관리자: 아이 은행계좌 추가 (최대 3). */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { groupId, childId, name, bankName, accountNumber, accountLabel } = body ?? {};

    if (!groupId || !childId) {
      return NextResponse.json({ error: 'groupId와 childId가 필요합니다.' }, { status: 400 });
    }

    const adminCheck = await requireGroupAdmin(user.id, groupId);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const piggy = await getPiggyAccountForUserIfExists(groupId, childId);
    if (!piggy) {
      return NextResponse.json({ error: '저금통이 없습니다. 먼저 저금통을 만들어 주세요.' }, { status: 400 });
    }

    const existing = await listPiggySavingsAccounts(groupId, childId);
    if (existing.length >= MAX_PIGGY_SAVINGS_ACCOUNTS) {
      return NextResponse.json(
        { error: `은행계좌는 최대 ${MAX_PIGGY_SAVINGS_ACCOUNTS}개까지 만들 수 있습니다.` },
        { status: 400 },
      );
    }

    const account = await createPiggySavingsAccount(groupId, childId, {
      name,
      bankName,
      accountNumber,
      accountLabel,
    });

    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '은행계좌 추가에 실패했습니다.';
    console.error('Piggy savings accounts create 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
