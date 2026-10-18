export type BillingPurchaseResult = 'purchased' | 'cancelled' | 'missing_product';

export async function openBillingPurchase(input: {
  apiKey: string;
  appUserId: string;
  groupId: string;
  productId: string;
  quotaAction: 'keep' | '5gb' | '20gb';
  customerEmail?: string;
}): Promise<BillingPurchaseResult> {
  const { Purchases, ErrorCode } = await import('@revenuecat/purchases-js');
  if (!Purchases.isConfigured()) {
    Purchases.configure({ apiKey: input.apiKey, appUserId: input.appUserId });
  }
  const purchases = Purchases.getSharedInstance();
  if (purchases.getAppUserId() !== input.appUserId) {
    await purchases.changeUser(input.appUserId);
  }
  await purchases.setAttributes({
    group_id: input.groupId,
    quota_action: input.quotaAction,
  });

  const offerings = await purchases.getOfferings();
  const packages = [
    ...Object.values(offerings.all),
    ...(offerings.current ? [offerings.current] : []),
  ].flatMap((offering) => offering.availablePackages);
  const selected = packages.find(
    (pkg) => pkg.product.identifier === input.productId || pkg.identifier === input.productId,
  );
  if (!selected) return 'missing_product';

  try {
    await purchases.purchase({
      rcPackage: selected,
      customerEmail: input.customerEmail,
    });
    return 'purchased';
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'errorCode' in error &&
      (error as { errorCode?: number }).errorCode === ErrorCode.UserCancelledError
    ) {
      return 'cancelled';
    }
    throw error;
  }
}
