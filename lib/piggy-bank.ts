import { getSupabaseServerClient } from './api-helpers';

export type PiggyAccount = {
  id: string;
  group_id: string;
  user_id: string | null;
  name: string;
  balance: number;
  currency: string;
};

export type PiggyWallet = {
  id: string;
  group_id: string;
  user_id: string;
  balance: number;
};

export type PiggySavingsAccount = {
  id: string;
  group_id: string;
  user_id: string;
  name: string;
  bank_name: string;
  account_number: string;
  account_label: string;
  balance: number;
  currency: string;
  annual_interest_rate_bps: number;
  interest_day: number;
  next_interest_on: string;
  tax_rate_bps: number;
};

const DEFAULT_PIGGY_NAME = 'Ellena Piggy Bank';
const DEFAULT_SAVINGS_NAME = 'Bank Account';
const DEFAULT_CURRENCY = 'KRW';
export const MAX_PIGGY_SAVINGS_ACCOUNTS = 3;

const SAVINGS_ACCOUNT_COLUMNS =
  'id, group_id, user_id, name, bank_name, account_number, account_label, balance, currency, annual_interest_rate_bps, interest_day, next_interest_on, tax_rate_bps';

/** 이자 지급일(1–28) 기준 다음 지급일(YYYY-MM-DD). fromDate 당일이면 다음 달. */
export function computeNextInterestOn(interestDay: number, fromDate: Date = new Date()): string {
  const day = Math.min(28, Math.max(1, Math.floor(interestDay) || 1));
  const y = fromDate.getFullYear();
  const m = fromDate.getMonth(); // 0-based
  const todayDay = fromDate.getDate();
  let year = y;
  let month = m;
  if (todayDay >= day) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** next_interest_on 을 interest_day 유지한 채 한 달 뒤로. */
export function advanceInterestOn(isoDate: string, interestDay: number): string {
  const day = Math.min(28, Math.max(1, Math.floor(interestDay) || 1));
  const parts = String(isoDate).slice(0, 10).split('-').map(Number);
  let year = parts[0] || new Date().getFullYear();
  let month = (parts[1] || 1) - 1; // 0-based
  month += 1;
  if (month > 11) {
    month = 0;
    year += 1;
  }
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 월 1회 단순 이자: gross / tax / net (정수, floor). */
export function calculateMonthlyInterest(
  balance: number,
  annualInterestRateBps: number,
  taxRateBps: number,
): { gross: number; tax: number; net: number } {
  const bal = Math.max(0, Math.floor(balance));
  const rate = Math.max(0, Math.floor(annualInterestRateBps));
  const taxBps = Math.max(0, Math.min(10000, Math.floor(taxRateBps)));
  const gross = Math.floor((bal * rate) / 10000 / 12);
  const tax = Math.floor((gross * taxBps) / 10000);
  const net = Math.max(0, gross - tax);
  return { gross, tax, net };
}

export function parsePiggyAmount(raw: unknown): number | null {
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(value as number)) return null;
  const amount = Math.floor(value as number);
  return amount > 0 ? amount : null;
}

/** 그룹에 설정된 Piggy 통화 (컬럼 없으면 KRW). */
export async function getGroupPiggyCurrency(groupId: string): Promise<string> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('groups').select('piggy_currency').eq('id', groupId).maybeSingle();
  if (error || !data) {
    return DEFAULT_CURRENCY;
  }
  const row = data as { piggy_currency?: string | null };
  const c = row.piggy_currency?.trim().toUpperCase();
  return c && /^[A-Z]{3}$/.test(c) ? c : DEFAULT_CURRENCY;
}

/** 아이별 저금통 (group_id, user_id) 조회 또는 생성. */
export async function ensurePiggyAccountForUser(groupId: string, userId: string): Promise<PiggyAccount> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('piggy_bank_accounts')
    .select('id, group_id, user_id, name, balance, currency')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as PiggyAccount;
  }

  const insertCurrency = await getGroupPiggyCurrency(groupId);

  const { data: created, error: createError } = await supabase
    .from('piggy_bank_accounts')
    .insert({
      group_id: groupId,
      user_id: userId,
      name: DEFAULT_PIGGY_NAME,
      balance: 0,
      currency: insertCurrency,
    })
    .select('id, group_id, user_id, name, balance, currency')
    .single();

  if (createError || !created) {
    throw createError || new Error('저금통 생성에 실패했습니다.');
  }

  return created as PiggyAccount;
}

/** 아이별 저금통이 있으면 반환, 없으면 null (생성하지 않음). */
export async function getPiggyAccountForUserIfExists(groupId: string, userId: string): Promise<PiggyAccount | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('piggy_bank_accounts')
    .select('id, group_id, user_id, name, balance, currency')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ? (data as PiggyAccount) : null;
}

/** 용돈 지갑이 있으면 반환, 없으면 null (생성하지 않음). */
export async function getPiggyWalletForUserIfExists(groupId: string, userId: string): Promise<PiggyWallet | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('piggy_wallets')
    .select('id, group_id, user_id, balance')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ? (data as PiggyWallet) : null;
}

/** 그룹 내 모든 저금통 목록 (관리자용). */
export async function getPiggyAccountsForGroup(groupId: string): Promise<PiggyAccount[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('piggy_bank_accounts')
    .select('id, group_id, user_id, name, balance, currency')
    .eq('group_id', groupId)
    .order('user_id', { ascending: true, nullsFirst: true });

  if (error) {
    throw error;
  }
  return (data || []) as PiggyAccount[];
}

/** 아이별 은행계좌 목록 (생성일순). */
export async function listPiggySavingsAccounts(
  groupId: string,
  userId: string,
): Promise<PiggySavingsAccount[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('piggy_savings_accounts')
    .select(SAVINGS_ACCOUNT_COLUMNS)
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as PiggySavingsAccount[];
}

/** 아이별 첫 은행계좌 (없으면 null). */
export async function getPiggySavingsForUserIfExists(
  groupId: string,
  userId: string,
): Promise<PiggySavingsAccount | null> {
  const list = await listPiggySavingsAccounts(groupId, userId);
  return list[0] ?? null;
}

export async function getPiggySavingsAccountById(
  groupId: string,
  accountId: string,
): Promise<PiggySavingsAccount | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('piggy_savings_accounts')
    .select(SAVINGS_ACCOUNT_COLUMNS)
    .eq('group_id', groupId)
    .eq('id', accountId)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as PiggySavingsAccount) : null;
}

/** 아이별 은행계좌가 0개면 1개 생성, 있으면 첫 계좌 반환. */
export async function ensurePiggySavingsAccount(
  groupId: string,
  userId: string,
): Promise<PiggySavingsAccount> {
  const existing = await getPiggySavingsForUserIfExists(groupId, userId);
  if (existing) return existing;

  return createPiggySavingsAccount(groupId, userId, {});
}

export async function createPiggySavingsAccount(
  groupId: string,
  userId: string,
  input: {
    name?: string;
    bankName?: string;
    accountNumber?: string;
    accountLabel?: string;
  },
): Promise<PiggySavingsAccount> {
  const list = await listPiggySavingsAccounts(groupId, userId);
  if (list.length >= MAX_PIGGY_SAVINGS_ACCOUNTS) {
    throw new Error(`은행계좌는 최대 ${MAX_PIGGY_SAVINGS_ACCOUNTS}개까지 만들 수 있습니다.`);
  }

  const supabase = getSupabaseServerClient();
  const insertCurrency = await getGroupPiggyCurrency(groupId);
  const interestDay = 1;
  const nextInterestOn = computeNextInterestOn(interestDay);
  const label = (input.accountLabel || 'Saving').trim().slice(0, 40) || 'Saving';

  const { data: created, error: createError } = await supabase
    .from('piggy_savings_accounts')
    .insert({
      group_id: groupId,
      user_id: userId,
      name: (input.name || DEFAULT_SAVINGS_NAME).trim().slice(0, 80) || DEFAULT_SAVINGS_NAME,
      bank_name: (input.bankName || '').trim().slice(0, 80),
      account_number: (input.accountNumber || '').trim().slice(0, 64),
      account_label: label,
      balance: 0,
      currency: insertCurrency,
      annual_interest_rate_bps: 0,
      interest_day: interestDay,
      next_interest_on: nextInterestOn,
      tax_rate_bps: 0,
    })
    .select(SAVINGS_ACCOUNT_COLUMNS)
    .single();

  if (createError || !created) {
    if (String(createError?.message || '').includes('MAX_SAVINGS_ACCOUNTS')) {
      throw new Error(`은행계좌는 최대 ${MAX_PIGGY_SAVINGS_ACCOUNTS}개까지 만들 수 있습니다.`);
    }
    throw createError || new Error('은행계좌 생성에 실패했습니다.');
  }

  return created as PiggySavingsAccount;
}

export async function ensurePiggyWallet(groupId: string, userId: string): Promise<PiggyWallet> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('piggy_wallets')
    .select('id, group_id, user_id, balance')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as PiggyWallet;
  }

  const { data: created, error: createError } = await supabase
    .from('piggy_wallets')
    .insert({
      group_id: groupId,
      user_id: userId,
      balance: 0,
    })
    .select('id, group_id, user_id, balance')
    .single();

  if (createError || !created) {
    throw createError || new Error('용돈 지갑 생성에 실패했습니다.');
  }

  return created as PiggyWallet;
}

export async function getGroupMembers(groupId: string): Promise<Array<{
  user_id: string;
  email: string | null;
  nickname: string | null;
  role: 'ADMIN' | 'MEMBER';
}>> {
  const supabase = getSupabaseServerClient();

  const { data: memberships, error: membershipError } = await supabase
    .from('memberships')
    .select('user_id, role')
    .eq('group_id', groupId);

  if (membershipError) {
    throw membershipError;
  }

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('owner_id')
    .eq('id', groupId)
    .single();

  if (groupError || !group) {
    throw groupError || new Error('그룹 정보를 찾을 수 없습니다.');
  }

  const memberIds = new Set<string>();
  const members: Array<{ user_id: string; role: 'ADMIN' | 'MEMBER' }> = [];

  memberships?.forEach((m) => {
    memberIds.add(m.user_id);
    members.push({ user_id: m.user_id, role: (m.role as 'ADMIN' | 'MEMBER') || 'MEMBER' });
  });

  if (!memberIds.has(group.owner_id)) {
    memberIds.add(group.owner_id);
    members.push({ user_id: group.owner_id, role: 'ADMIN' });
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, nickname')
    .in('id', Array.from(memberIds));

  if (profileError) {
    throw profileError;
  }

  return members.map((member) => {
    const profile = profiles?.find((p) => p.id === member.user_id);
    return {
      user_id: member.user_id,
      email: profile?.email || null,
      nickname: profile?.nickname || null,
      role: member.role,
    };
  });
}

/** 부모 대리 입력: asProxy + childId + 관리자일 때만 아이 잔고를 대상으로 함. */
export type PiggyProxyTarget =
  | { ok: true; targetUserId: string; isProxy: boolean; actorUserId: string }
  | { ok: false; error: string; status: number };

export function resolvePiggyProxyTarget(input: {
  actorUserId: string;
  childId?: unknown;
  asProxy?: unknown;
  isAdmin: boolean;
}): PiggyProxyTarget {
  const wantsProxy = input.asProxy === true || input.asProxy === 'true' || input.asProxy === 1;
  const childId = typeof input.childId === 'string' ? input.childId.trim() : '';

  if (!wantsProxy) {
    return {
      ok: true,
      targetUserId: input.actorUserId,
      isProxy: false,
      actorUserId: input.actorUserId,
    };
  }

  if (!input.isAdmin) {
    return { ok: false, error: '부모 대리 입력 권한이 없습니다.', status: 403 };
  }
  if (!childId) {
    return { ok: false, error: '대리 입력할 아이를 선택해주세요.', status: 400 };
  }
  if (childId === input.actorUserId) {
    return { ok: false, error: '본인에게는 대리 입력을 할 수 없습니다.', status: 400 };
  }

  return {
    ok: true,
    targetUserId: childId,
    isProxy: true,
    actorUserId: input.actorUserId,
  };
}

export function withPiggyProxyMemo(memo: string | null | undefined, isProxy: boolean): string | null {
  const base = memo ? String(memo).trim().slice(0, 180) : '';
  if (!isProxy) return base || null;
  const tag = '부모 대리';
  if (!base) return tag;
  if (base.includes(tag)) return base.slice(0, 200);
  return `${base} · ${tag}`.slice(0, 200);
}

