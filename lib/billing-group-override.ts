import { getSupabaseServerClient } from '@/lib/api-helpers';

export type BillingGroupOverride = {
  quotaAdminSet: boolean;
  billingComp: boolean;
  compSeats: number | null;
};

const EMPTY_OVERRIDE: BillingGroupOverride = {
  quotaAdminSet: false,
  billingComp: false,
  compSeats: null,
};

export async function getBillingGroupOverride(groupId: string): Promise<BillingGroupOverride> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('billing_group_overrides')
    .select('quota_admin_set, billing_comp, comp_seats')
    .eq('group_id', groupId)
    .maybeSingle();
  if (error || !data) return EMPTY_OVERRIDE;
  return {
    quotaAdminSet: data.quota_admin_set === true,
    billingComp: data.billing_comp === true,
    compSeats: typeof data.comp_seats === 'number' ? data.comp_seats : null,
  };
}
