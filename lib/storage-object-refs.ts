import { deleteFromS3, generatePublicAssetUrl } from '@/lib/api-helpers';
import { DB_TABLES } from '@/lib/db-table-names';
import type { SupabaseClient } from '@supabase/supabase-js';

type ServerClient = SupabaseClient;

/** Live references to one S3 object (album + attachments). */
async function countLiveS3KeyRefs(
  supabase: ServerClient,
  groupId: string,
  s3Key: string,
  opts?: { ignoreAlbumId?: string; ignoreAttachmentId?: string },
): Promise<number> {
  const key = String(s3Key || '').trim();
  if (!key) return 0;

  let albumQuery = supabase
    .from(DB_TABLES.FAMILY_ALBUM_ITEMS)
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('s3_key', key);
  if (opts?.ignoreAlbumId) albumQuery = albumQuery.neq('id', opts.ignoreAlbumId);

  let attQuery = supabase
    .from(DB_TABLES.ATTACHMENTS)
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('s3_key', key)
    .is('deleted_at', null);
  if (opts?.ignoreAttachmentId) attQuery = attQuery.neq('id', opts.ignoreAttachmentId);

  let thumbQuery = supabase
    .from(DB_TABLES.ATTACHMENTS)
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('thumbnail_s3_key', key)
    .is('deleted_at', null);
  if (opts?.ignoreAttachmentId) thumbQuery = thumbQuery.neq('id', opts.ignoreAttachmentId);

  const [album, att, thumb] = await Promise.all([albumQuery, attQuery, thumbQuery]);
  return (album.count ?? 0) + (att.count ?? 0) + (thumb.count ?? 0);
}

export async function deleteS3IfUnreferenced(
  supabase: ServerClient,
  groupId: string,
  s3Key: string | null | undefined,
  opts?: { ignoreAlbumId?: string; ignoreAttachmentId?: string },
): Promise<boolean> {
  const key = String(s3Key || '').trim();
  if (!key) return false;
  const refs = await countLiveS3KeyRefs(supabase, groupId, key, opts);
  if (refs > 0) return false;
  return deleteFromS3(key);
}

/** Diary upload: one S3 object, also visible in family album. Skip if that key already exists. */
export async function ensureFamilyAlbumItemForDiaryPhoto(
  supabase: ServerClient,
  params: {
    groupId: string;
    userId: string;
    s3Key: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
  },
): Promise<void> {
  const s3Key = String(params.s3Key || '').trim();
  if (!s3Key) return;

  const { data: existing } = await supabase
    .from(DB_TABLES.FAMILY_ALBUM_ITEMS)
    .select('id')
    .eq('group_id', params.groupId)
    .eq('s3_key', s3Key)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return;

  const imageUrl = generatePublicAssetUrl(s3Key);
  const { error } = await supabase.from(DB_TABLES.FAMILY_ALBUM_ITEMS).insert({
    uploader_id: params.userId,
    group_id: params.groupId,
    image_url: imageUrl,
    s3_original_url: imageUrl,
    file_type: 'photo',
    original_file_size: params.sizeBytes,
    s3_key: s3Key,
    mime_type: params.mimeType,
    original_filename: params.originalFilename,
    upload_mode: 'normal',
  });

  if (error) {
    console.error('ensureFamilyAlbumItemForDiaryPhoto:', error);
  }
}
