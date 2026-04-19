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

/**
 * Supabase에서 다시 불러온 목록으로 state를 덮을 때 사용.
 * 이전에 시작된 fetch가 insert 보다 먼저 끝나면 새 메시지가 스냅샷에 없어 UI에서 사라질 수 있음 →
 * DB 스냅샷에 없는 id는 기존 state에서 유지한다.
 */
export function mergeChatMessagesWithExisting(
  fromDb: ChatUiMessage[],
  existing: ChatUiMessage[] | undefined | null
): ChatUiMessage[] {
  const dbIds = new Set(fromDb.map((m) => String(m.id)));
  const onlyInUi = (existing || []).filter((m) => !dbIds.has(String(m.id)));
  if (onlyInUi.length === 0) return trimMessagesToMax(fromDb);

  const byId = new Map<string, ChatUiMessage>();
  for (const m of fromDb) {
    byId.set(String(m.id), m);
  }
  for (const m of onlyInUi) {
    if (!byId.has(String(m.id))) {
      byId.set(String(m.id), m);
    }
  }
  const merged = Array.from(byId.values()).sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });
  return trimMessagesToMax(merged);
}
