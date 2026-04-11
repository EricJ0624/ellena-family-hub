/**
 * 가족 채팅(Family Chat) 타입 정의  
 */

export type { ChatUiMessage, ChatMessageRow } from '@/lib/chat-messages';

export type ChatAttachment = {
  id: string;
  entity_id: string;
  entity_type: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
};
