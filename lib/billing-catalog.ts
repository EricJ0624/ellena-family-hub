import type { AppId } from '@/lib/apps';
import { isAppId } from '@/lib/apps';

export type BillingQuotaTier = '5gb' | '20gb';

export type ParsedBillingProduct = {
  appId: AppId;
  seatCount: number;
  quotaTier: BillingQuotaTier;
  /** 정식 가격의 50% 상품. 할인코드 사용 기록이 있어야 반영한다. */
  betaPrice: boolean;
};

const PRODUCT_PATTERN =
  /^(hearth_family|hearth_couple|hearth_biker|hearth_camper)_seats_(\d+)_(5gb|10gb|20gb)(_beta)?$/;

export function parseBillingProductId(productId: string): ParsedBillingProduct | null {
  const match = PRODUCT_PATTERN.exec(productId.trim());
  if (!match) return null;
  const appId = match[1];
  const seatCount = Number(match[2]);
  const rawTier = match[3];
  if (!isAppId(appId) || !Number.isInteger(seatCount) || seatCount < 1) return null;
  const quotaTier: BillingQuotaTier = rawTier === '5gb' ? '5gb' : '20gb';
  return {
    appId,
    seatCount,
    quotaTier,
    betaPrice: match[4] === '_beta',
  };
}

export function buildBillingProductId(input: {
  appId: AppId;
  seatCount: number;
  quotaTier: BillingQuotaTier;
  betaPrice: boolean;
}): string {
  const suffix = input.betaPrice ? '_beta' : '';
  return `${input.appId}_seats_${input.seatCount}_${input.quotaTier}${suffix}`;
}

export function billingAppUserId(appId: AppId, userId: string): string {
  return `${appId}:${userId}`;
}

export function parseBillingAppUserId(
  appUserId: string,
): { appId: AppId; userId: string } | null {
  const separator = appUserId.indexOf(':');
  if (separator <= 0) return null;
  const appId = appUserId.slice(0, separator);
  const userId = appUserId.slice(separator + 1).trim();
  if (!isAppId(appId) || !userId) return null;
  return { appId, userId };
}
