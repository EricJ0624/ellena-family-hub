/**
 * Logical table keys mapped to current physical table names.
 * Keep physical names stable first; swap values only in controlled rename phases.
 */
export const DB_TABLES = {
  ATTACHMENTS: 'attachments',
  FAMILY_MESSAGES: 'family_chat_messages',
  FAMILY_ALBUM_ITEMS: 'family_album_items',
} as const;

