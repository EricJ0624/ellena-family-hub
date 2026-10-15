import { randomBytes } from 'crypto';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import type { AppId } from '@/lib/apps';
import { getAppBetaQualification } from '@/lib/beta-testers';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type BillingPriceNotice = {
  /** 베타 기간에는 카드 청구가 없다. */
  virtualPayment: boolean;
  includedSeats: number;
  currency: string;
  basePriceCents: number;
  extraSeatPriceCents: number;
  storageUpgradePriceCents: number;
  betaBasePriceCents: number;
  betaExtraSeatPriceCents: number;
  betaStorageUpgradePriceCents: number;
};

export class BillingMessageError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function discountCents(priceCents: number, discountPercent: number): number {
  return Math.round((priceCents * (100 - discountPercent)) / 100);
}

function makeCode(): string {
  const bytes = randomBytes(8);
  let body = '';
  for (const byte of bytes) {
    body += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return `BETA-${body}`;
}

async function loadPriceNotice(appId: AppId): Promise<BillingPriceNotice> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('billing_plans')
    .select(
      'included_seats, currency, base_price_cents, extra_seat_price_cents, storage_upgrade_price_cents, beta_discount_percent',
    )
    .eq('app_id', appId)
    .single();
  if (error || !data) {
    throw new BillingMessageError('plan_missing', '요금 설정을 찾지 못했습니다.');
  }
  const discountPercent = data.beta_discount_percent;
  return {
    virtualPayment: process.env.BILLING_ACCEPT_LIVE_STORE !== 'true',
    includedSeats: data.included_seats,
    currency: data.currency,
    basePriceCents: data.base_price_cents,
    extraSeatPriceCents: data.extra_seat_price_cents,
    storageUpgradePriceCents: data.storage_upgrade_price_cents,
    betaBasePriceCents: discountCents(data.base_price_cents, discountPercent),
    betaExtraSeatPriceCents: discountCents(data.extra_seat_price_cents, discountPercent),
    betaStorageUpgradePriceCents: discountCents(data.storage_upgrade_price_cents, discountPercent),
  };
}

export async function ensureOwnerBetaPromoCode(input: {
  appId: AppId;
  userId: string;
  groupId: string;
}): Promise<{ code: string; notice: BillingPriceNotice }> {
  const supabase = getSupabaseServerClient();
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, owner_id, app_id')
    .eq('id', input.groupId)
    .maybeSingle();
  if (groupError || !group || group.app_id !== input.appId) {
    throw new BillingMessageError('group_missing', '그룹을 찾지 못했습니다.');
  }
  if (group.owner_id !== input.userId) {
    throw new BillingMessageError('promo_owner_view', '그룹 오너만 할인코드를 볼 수 있습니다.');
  }

  const beta = await getAppBetaQualification(input.appId, input.userId);
  if (!beta.qualified) {
    throw new BillingMessageError('not_beta', '베타 자격이 없습니다.');
  }

  const { data: existing, error: existingError } = await supabase
    .from('billing_promo_codes')
    .select('code')
    .eq('app_id', input.appId)
    .eq('group_id', input.groupId)
    .eq('active', true)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.code) {
    return { code: existing.code, notice: await loadPriceNotice(input.appId) };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeCode();
    const { error } = await supabase.from('billing_promo_codes').insert({
      app_id: input.appId,
      code,
      group_id: input.groupId,
    });
    if (!error) {
      return { code, notice: await loadPriceNotice(input.appId) };
    }
    if (error.code !== '23505') throw error;
  }
  throw new BillingMessageError('promo_create_failed', '할인코드를 만들지 못했습니다.');
}

/**
 * 코드 확인만 한다. 그룹 용량은 바꾸지 않는다.
 * 성공 시 그 그룹의 50% 자격 기록이 남는다.
 */
export async function redeemBetaPromoCode(input: {
  appId: AppId;
  userId: string;
  groupId: string;
  code: string;
}): Promise<{ notice: BillingPriceNotice }> {
  const supabase = getSupabaseServerClient();
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, owner_id, app_id')
    .eq('id', input.groupId)
    .maybeSingle();
  if (groupError || !group || group.app_id !== input.appId) {
    throw new BillingMessageError('group_missing', '그룹을 찾지 못했습니다.');
  }
  if (group.owner_id !== input.userId) {
    throw new BillingMessageError('promo_owner_use', '그룹 오너만 할인코드를 사용할 수 있습니다.');
  }

  const beta = await getAppBetaQualification(input.appId, input.userId);
  if (!beta.qualified) {
    throw new BillingMessageError('not_beta', '베타 자격이 없습니다.');
  }

  const normalized = input.code.trim().toUpperCase();
  const { data: promo, error: promoError } = await supabase
    .from('billing_promo_codes')
    .select('id, redeemed_count, max_redemptions, active, expires_at, group_id')
    .eq('app_id', input.appId)
    .eq('code', normalized)
    .maybeSingle();
  if (promoError || !promo || !promo.active || promo.group_id !== input.groupId) {
    throw new BillingMessageError('promo_invalid', '할인코드를 확인할 수 없습니다.');
  }
  if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) {
    throw new BillingMessageError('promo_expired', '할인코드가 만료되었습니다.');
  }

  const { data: already } = await supabase
    .from('billing_promo_redemptions')
    .select('id')
    .eq('app_id', input.appId)
    .eq('group_id', input.groupId)
    .maybeSingle();
  if (!already?.id) {
    if (promo.redeemed_count >= promo.max_redemptions) {
      throw new BillingMessageError('promo_maxed', '할인코드 사용 횟수를 초과했습니다.');
    }
    const { error: redeemError } = await supabase.from('billing_promo_redemptions').insert({
      app_id: input.appId,
      code_id: promo.id,
      user_id: input.userId,
      group_id: input.groupId,
    });
    if (redeemError && redeemError.code !== '23505') throw redeemError;
    if (!redeemError) {
      await supabase
        .from('billing_promo_codes')
        .update({ redeemed_count: promo.redeemed_count + 1 })
        .eq('id', promo.id);
    }
  }

  await supabase
    .from('billing_customers')
    .update({ beta_discount_lifetime: true, updated_at: new Date().toISOString() })
    .eq('app_id', input.appId)
    .eq('group_id', input.groupId);

  return { notice: await loadPriceNotice(input.appId) };
}
