/**
 * support_tickets.message_thread JSON 항목
 * 첫 문의(content) · 첫 답변(answer) 이후의 추가 문의/답변만 저장합니다.
 */

export type SupportTicketThreadEntry = {
  /** 첨부 entity_id로 사용. 구 데이터는 없을 수 있음. */
  id?: string;
  role: 'group_admin' | 'system_admin';
  user_id: string;
  body: string;
  created_at: string;
};

const UUID_ANY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseMessageThread(raw: unknown): SupportTicketThreadEntry[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: SupportTicketThreadEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const role = o.role;
    const user_id = o.user_id;
    const body = o.body;
    const created_at = o.created_at;
    if (
      (role === 'group_admin' || role === 'system_admin') &&
      typeof user_id === 'string' &&
      typeof body === 'string' &&
      typeof created_at === 'string'
    ) {
      const id = typeof o.id === 'string' && UUID_ANY.test(o.id) ? o.id : undefined;
      out.push(id ? { id, role, user_id, body, created_at } : { role, user_id, body, created_at });
    }
  }
  return out;
}
