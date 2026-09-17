import type { SupabaseClient } from '@supabase/supabase-js';
import { DB_TABLES } from '@/lib/db-table-names';
import { deleteS3IfUnreferenced } from '@/lib/storage-object-refs';

type ServerClient = SupabaseClient;

export type SupportAttachmentEntityType = 'member_support_ticket' | 'support_ticket';

type TicketAttachmentSource = {
  id: string;
  answer_message_id?: string | null;
  message_thread?: unknown;
};

const UUID_ANY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 문의 본문·첫 답변·스레드에 연결된 첨부 entity_id 목록 */
export function collectTicketAttachmentEntityIds(ticket: TicketAttachmentSource): string[] {
  const ids = new Set<string>();
  if (ticket.id && UUID_ANY.test(ticket.id)) ids.add(ticket.id);
  if (ticket.answer_message_id && UUID_ANY.test(String(ticket.answer_message_id))) {
    ids.add(String(ticket.answer_message_id));
  }
  const thread = Array.isArray(ticket.message_thread) ? ticket.message_thread : [];
  for (const entry of thread) {
    if (!entry || typeof entry !== 'object') continue;
    const id = (entry as { id?: unknown }).id;
    if (typeof id === 'string' && UUID_ANY.test(id)) ids.add(id);
  }
  return Array.from(ids);
}

/**
 * 문의 삭제 전: 해당 문의에 묶인 attachments soft-delete + 미참조 S3 제거.
 * 실패해도 티켓 삭제는 막지 않도록 호출측에서 로그만 남기면 됩니다.
 */
export async function deleteAttachmentsForSupportTicket(
  supabase: ServerClient,
  params: {
    groupId: string;
    entityType: SupportAttachmentEntityType;
    ticket: TicketAttachmentSource;
  }
): Promise<{ deletedCount: number }> {
  const entityIds = collectTicketAttachmentEntityIds(params.ticket);
  if (entityIds.length === 0) return { deletedCount: 0 };

  const { data: rows, error } = await supabase
    .from(DB_TABLES.ATTACHMENTS)
    .select('id, s3_key, thumbnail_s3_key')
    .eq('group_id', params.groupId)
    .eq('entity_type', params.entityType)
    .in('entity_id', entityIds)
    .is('deleted_at', null);

  if (error) {
    console.error('문의 첨부 조회 오류(삭제 전):', error);
    throw new Error('문의 첨부 정리에 실패했습니다.');
  }

  const list = rows ?? [];
  if (list.length === 0) return { deletedCount: 0 };

  const now = new Date().toISOString();

  for (const row of list) {
    if (row.s3_key) {
      await deleteS3IfUnreferenced(supabase, params.groupId, row.s3_key, {
        ignoreAttachmentId: String(row.id),
      });
    }
    if (row.thumbnail_s3_key) {
      await deleteS3IfUnreferenced(supabase, params.groupId, row.thumbnail_s3_key, {
        ignoreAttachmentId: String(row.id),
      });
    }
  }

  const ids = list.map((r) => String(r.id));
  const { error: updErr } = await supabase
    .from(DB_TABLES.ATTACHMENTS)
    .update({ deleted_at: now })
    .eq('group_id', params.groupId)
    .in('id', ids)
    .is('deleted_at', null);

  if (updErr) {
    console.error('문의 첨부 soft-delete 오류:', updErr);
    throw new Error('문의 첨부 정리에 실패했습니다.');
  }

  return { deletedCount: ids.length };
}
