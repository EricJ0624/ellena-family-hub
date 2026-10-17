import { supabase } from '@/lib/supabase';

export async function familyLogAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('auth');
  return { Authorization: `Bearer ${token}` };
}
