import { supabase } from '@/lib/supabase';

export async function familyLogAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('auth');
  return { Authorization: `Bearer ${token}` };
}

export async function deleteFamilyLogCard(cardId: string, groupId: string): Promise<void> {
  const headers = await familyLogAuthHeaders();
  const res = await fetch(`/api/v1/family-log/cards/${cardId}`, {
    method: 'DELETE',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId }),
  });
  if (!res.ok) throw new Error('delete');
}
