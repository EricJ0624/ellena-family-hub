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

const DEFAULT_PIGGY_NAME = 'Ellena Piggy Bank';
const DEFAULT_CURRENCY = 'KRW';

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

  const { data: created, error: createError } = await supabase
    .from('piggy_bank_accounts')
    .insert({
      group_id: groupId,
      user_id: userId,
      name: DEFAULT_PIGGY_NAME,
      balance: 0,
      currency: DEFAULT_CURRENCY,
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

