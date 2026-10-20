import type { SupabaseClient } from '@supabase/supabase-js';
import { releaseS3Key } from '@/lib/storage-object-refs';
import { DB_TABLES } from '@/lib/db-table-names';

const CHAT_ATTACHMENT_TTL_MS = 60 * 24 * 60 * 60 * 1000;
const EXPIRED_ATTACHMENT_MARKER = 'expired';

type ExpiringRow = {
  id: string;
  group_id: string;
  s3_key: string | null;
  thumbnail_s3_key: string | null;
};

/** 60일이 지난 채팅 첨부만 S3에서 지우고, 기록은 만료 표시로 남긴다. */
async function forgetChatObject(
  supabase: SupabaseClient,
  groupId: string,
  attachmentId: string,
  s3Key: string | null,
): Promise<boolean> {
  if (!s3Key || s3Key === EXPIRED_ATTACHMENT_MARKER) return true;
  const result = await releaseS3Key(supabase, groupId, s3Key, {
    ignoreAttachmentId: attachmentId,
  });
  return result !== 'failed';
}

export async function expireOldChatAttachments(
  supabase: SupabaseClient,
  groupId: string,
): Promise<void> {
  const cutoff = new Date(Date.now() - CHAT_ATTACHMENT_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from(DB_TABLES.ATTACHMENTS)
    .select('id, group_id, s3_key, thumbnail_s3_key')
    .eq('group_id', groupId)
    .eq('feature_type', 'chat')
    .eq('entity_type', 'chat_message')
    .is('deleted_at', null)
    .lt('created_at', cutoff)
    .neq('s3_key', EXPIRED_ATTACHMENT_MARKER)
    .order('created_at', { ascending: true })
    .limit(40);
  if (error || !data?.length) return;

  for (const row of data as ExpiringRow[]) {
    try {
      const mainGone = await forgetChatObject(supabase, row.group_id, row.id, row.s3_key);
      const thumbGone = await forgetChatObject(supabase, row.group_id, row.id, row.thumbnail_s3_key);
      if (!mainGone || !thumbGone) continue;
      await supabase
        .from(DB_TABLES.ATTACHMENTS)
        .update({
          s3_key: EXPIRED_ATTACHMENT_MARKER,
          thumbnail_s3_key: null,
          image_url: EXPIRED_ATTACHMENT_MARKER,
          thumbnail_url: null,
        })
        .eq('id', row.id)
        .eq('group_id', groupId);
    } catch {
      // 한 건이 실패해도 채팅 목록은 그대로 연다. 다음 조회에서 다시 시도한다.
    }
  }
}
