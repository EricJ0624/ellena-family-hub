/**
 * 가족 채팅(family_messages) — 페이지 크기·DB 행 → UI 메시지 포맷
 */
import { CryptoService } from '@/lib/dashboard-storage';

export const CHAT_PAGE_SIZE = 50;

/** 클라이언트에 유지할 상한(메모리). 초과 시 가장 오래된 쪽부터 제거 */
export const CHAT_MAX_MESSAGES_IN_MEMORY = 600;

export type ChatMessageRow = {
  id: string;
  message_text?: string | null;
  sender_id?: string | null;
  created_at: string;
};

export type ChatUiMessage = {
  id: string;
  user: string;
  text: string;
  time: string;
  sender_id?: string;
  /** DB 커서(이전 페이지 조회용), ISO 문자열 */
  created_at?: string;
};

export function formatFamilyMessagesFromRows(
  rows: ChatMessageRow[],
  currentKey: string
): ChatUiMessage[] {
  return rows.map((msg) => {
    const createdAt = new Date(msg.created_at);
    const timeStr = `${createdAt.getHours()}:${String(createdAt.getMinutes()).padStart(2, '0')}`;
    let decryptedText = msg.message_text || '';
    if (currentKey && msg.message_text) {
      const isEncrypted = msg.message_text.startsWith('U2FsdGVkX1');
      if (isEncrypted) {
        try {
          const decrypted = CryptoService.decrypt(msg.message_text, currentKey);
          if (typeof decrypted === 'string') {
            decryptedText = decrypted;
          } else {
            decryptedText = msg.message_text;
          }
        } catch {
          decryptedText = msg.message_text;
        }
      } else {
        decryptedText = msg.message_text;
      }
    } else {
      decryptedText = msg.message_text || '';
    }
    return {
      id: msg.id,
      user: '사용자',
      text: decryptedText,
      time: timeStr,
      sender_id: msg.sender_id ?? undefined,
      created_at: msg.created_at,
    };
  });
}

export function trimMessagesToMax(messages: ChatUiMessage[]): ChatUiMessage[] {
  if (messages.length <= CHAT_MAX_MESSAGES_IN_MEMORY) return messages;
  return messages.slice(messages.length - CHAT_MAX_MESSAGES_IN_MEMORY);
}
