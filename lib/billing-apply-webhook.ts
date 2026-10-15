import { createHash, timingSafeEqual } from 'crypto';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import type { AppId } from '@/lib/apps';
import { getAppBetaQualification } from '@/lib/beta-testers';
import { getGroupStorageQuotaBytes } from '@/lib/storage-quota';
import {
  parseBillingAppUserId,
  parseBillingProductId,
  type BillingQuotaTier,
} from '@/lib/billing-catalog';

type AttributeValue = { value?: string } | string | null | undefined;

export type RevenueCatWebhookBody = {
  event?: {
    id?: string;
    type?: string;
    app_user_id?: string;
    product_id?: string;
    store?: string;
    entitlement_id?: string | null;
    entitlement_ids?: string[] | null;
    expiration_at_ms?: number | null;
    subscriber_attributes?: Record<string, AttributeValue>;
  };
};

const APPLY_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
]);

export function billingWebhookAuthorized(header: string | null): boolean {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION?.trim();
  if (!expected || !header) return false;
  const actualHash = createHash('sha256').update(header).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export function liveStoreAccepted(): boolean {
  return process.env.BILLING_ACCEPT_LIVE_STORE === 'true';
}

function attributeValue(
  attributes: Record<string, AttributeValue> | undefined,
  key: string,
): string {
  const raw = attributes?.[key];
  if (!raw) return '';
  if (typeof raw === 'string') return raw.trim();
  return typeof raw.value === 'string' ? raw.value.trim() : '';
}

function mapStore(store: string | undefined): 'test_store' | 'play_store' | 'other' {
  const normalized = (store ?? '').toUpperCase();
  if (normalized === 'TEST_STORE') return 'test_store';
  if (normalized === 'PLAY_STORE') return 'play_store';
  return 'other';
}

export async function applyRevenueCatWebhook(body: RevenueCatWebhookBody): Promise<{
  status: number;
  result: string;
}> {
  const event = body.event;
  const eventId = event?.id?.trim() ?? '';
  const eventType = event?.type?.trim() ?? '';
  if (!eventId || !eventType) {
    return { status: 400, result: 'missing_event' };
  }

  const parsedUser = parseBillingAppUserId(event?.app_user_id ?? '');
  const product = parseBillingProductId(event?.product_id ?? '');
  const groupId = attributeValue(event?.subscriber_attributes, 'group_id');
  if (!parsedUser || !product || !groupId) {
    return { status: 400, result: 'missing_purchase_target' };
  }
  if (parsedUser.appId !== product.appId) {
    return { status: 400, result: 'app_mismatch' };
  }

  const store = mapStore(event?.store);
  if (store === 'other') {
    return { status: 400, result: 'unsupported_store' };
  }
  if (store === 'play_store' && !liveStoreAccepted()) {
    await rememberEvent(product.appId, eventId, 'ignored_live_store');
    return { status: 200, result: 'ignored_live_store' };
  }

  const supabase = getSupabaseServerClient();
  const { data: existing } = await supabase
    .from('billing_webhook_events')
    .select('event_id')
    .eq('app_id', product.appId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (existing?.event_id) {
    return { status: 200, result: 'duplicate' };
  }

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, owner_id, app_id')
    .eq('id', groupId)
    .maybeSingle();
  if (groupError || !group) {
    return { status: 400, result: 'group_not_found' };
  }
  if (group.app_id !== product.appId || group.owner_id !== parsedUser.userId) {
    return { status: 400, result: 'owner_mismatch' };
  }

  if (product.betaPrice) {
    const beta = await getAppBetaQualification(product.appId, parsedUser.userId);
    const { data: redemption } = await supabase
      .from('billing_promo_redemptions')
      .select('id')
      .eq('app_id', product.appId)
      .eq('group_id', groupId)
      .maybeSingle();
    if (!beta.qualified || !redemption?.id) {
      await rememberEvent(product.appId, eventId, 'rejected_beta_price');
      return { status: 200, result: 'rejected_beta_price' };
    }
  }

  const { data: plan, error: planError } = await supabase
    .from('billing_plans')
    .select('base_quota_bytes, upgraded_quota_bytes, beta_free_quota_bytes')
    .eq('app_id', product.appId)
    .single();
  if (planError || !plan) {
    return { status: 500, result: 'plan_missing' };
  }

  const reverting = eventType === 'EXPIRATION';
  const applying = APPLY_TYPES.has(eventType);

  if (!applying && !reverting && eventType !== 'BILLING_ISSUE' && eventType !== 'CANCELLATION') {
    await rememberEvent(product.appId, eventId, eventType);
    return { status: 200, result: 'ignored_type' };
  }

  const requestedAction = attributeValue(event?.subscriber_attributes, 'quota_action');
  let quotaBytes = quotaBytesForTier(product.quotaTier, plan);
  if (requestedAction === '5gb' || requestedAction === '10gb') {
    quotaBytes = quotaBytesForTier(requestedAction, plan);
  } else if (requestedAction === 'keep') {
    quotaBytes = await getGroupStorageQuotaBytes(groupId);
  }

  const status = reverting
    ? 'expired'
    : eventType === 'BILLING_ISSUE'
      ? 'billing_issue'
      : eventType === 'CANCELLATION'
        ? 'cancelled'
        : 'active';

  const { error: customerError } = await supabase.from('billing_customers').upsert(
    {
      app_id: product.appId,
      user_id: parsedUser.userId,
      group_id: groupId,
      revenuecat_app_user_id: event?.app_user_id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'app_id,group_id' },
  );
  if (customerError) {
    console.error('billing customer upsert 오류:', customerError);
    return { status: 500, result: 'customer_write_failed' };
  }

  const periodEnd =
    typeof event?.expiration_at_ms === 'number'
      ? new Date(event.expiration_at_ms).toISOString()
      : null;
  const entitlementId =
    event?.entitlement_id ??
    (Array.isArray(event?.entitlement_ids) ? event?.entitlement_ids[0] : null) ??
    null;

  const { error: subscriptionError } = await supabase.from('billing_subscriptions').upsert(
    {
      app_id: product.appId,
      user_id: parsedUser.userId,
      group_id: groupId,
      product_id: event?.product_id,
      status,
      seat_count: product.seatCount,
      quota_bytes: quotaBytes,
      store,
      current_period_end: periodEnd,
      revenuecat_entitlement_id: entitlementId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'app_id,group_id' },
  );
  if (subscriptionError) {
    console.error('billing subscription upsert 오류:', subscriptionError);
    return { status: 500, result: 'subscription_write_failed' };
  }

  if (applying && requestedAction !== 'keep') {
    const { error: quotaError } = await supabase
      .from('groups')
      .update({ storage_quota_bytes: quotaBytes })
      .eq('id', groupId)
      .eq('app_id', product.appId);
    if (quotaError) {
      console.error('그룹 용량 반영 오류:', quotaError);
      return { status: 500, result: 'quota_write_failed' };
    }
  }

  if (reverting) {
    const beta = await getAppBetaQualification(product.appId, parsedUser.userId);
    if (beta.qualified) {
      const { error: quotaError } = await supabase
        .from('groups')
        .update({ storage_quota_bytes: plan.beta_free_quota_bytes })
        .eq('id', groupId)
        .eq('app_id', product.appId);
      if (quotaError) {
        console.error('베타 용량 복귀 오류:', quotaError);
        return { status: 500, result: 'quota_revert_failed' };
      }
    }
  }

  await rememberEvent(product.appId, eventId, eventType);
  return { status: 200, result: 'applied' };
}

function quotaBytesForTier(
  tier: BillingQuotaTier,
  plan: { base_quota_bytes: number; upgraded_quota_bytes: number },
): number {
  return tier === '10gb' ? plan.upgraded_quota_bytes : plan.base_quota_bytes;
}

async function rememberEvent(appId: AppId, eventId: string, eventType: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('billing_webhook_events').insert({
    app_id: appId,
    event_id: eventId,
    event_type: eventType,
  });
  if (error && error.code !== '23505') {
    console.error('billing webhook event 기록 오류:', error);
    throw error;
  }
}
