import { DB_TABLES } from '@/lib/db-table-names';
import { supabase } from '@/lib/supabase';

function isGenericLibraryFilename(name: string): boolean {
  const base = name.trim().toLowerCase();
  return /^(image|img|photo|picture|사진)(\s*\(\d+\))?\.(jpe?g|png|webp|heic|heif)$/.test(base);
}

/** 같은 파일이 가족 앨범에 있으면 그 앨범 id. 없으면 null. */
export async function findExistingAlbumItemId(
  groupId: string,
  file: File,
  contentSha256: string,
): Promise<string | null> {
  const hashMarker = `sha256:${contentSha256}`;
  const { data: byHash } = await supabase
    .from(DB_TABLES.FAMILY_ALBUM_ITEMS)
    .select('id')
    .eq('group_id', groupId)
    .eq('description', hashMarker)
    .limit(1)
    .maybeSingle();
  const hashId = (byHash as { id?: string } | null)?.id;
  if (hashId) return String(hashId);

  if (!file.name || file.size <= 0 || isGenericLibraryFilename(file.name)) return null;
  const { data: byFile } = await supabase
    .from(DB_TABLES.FAMILY_ALBUM_ITEMS)
    .select('id')
    .eq('group_id', groupId)
    .eq('original_filename', file.name)
    .eq('original_file_size', file.size)
    .limit(1)
    .maybeSingle();
  const fileId = (byFile as { id?: string } | null)?.id;
  return fileId ? String(fileId) : null;
}
