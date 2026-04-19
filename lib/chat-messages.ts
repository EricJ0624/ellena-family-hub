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
 * - 진행 중이던 fetch가 insert보다 먼저 끝나면 스냅샷에 없는 행은 기존 state에서 유지
 * - 같은 id가 양쪽에 있으면, 복호화 실패로 암호문만 있을 때는 화면에 이미 있는 평문을 유지
 */
export function mergeChatMessagesWithExisting(
  fromDb: ChatUiMessage[],
  existing: ChatUiMessage[] | undefined | null
): ChatUiMessage[] {
  const existingList = existing || [];
  const byId = new Map<string, ChatUiMessage>();

  for (const m of fromDb) {
    byId.set(String(m.id), m);
  }

  for (const m of existingList) {
    const id = String(m.id);
    const fromDbMsg = byId.get(id);
    if (!fromDbMsg) {
      byId.set(id, m);
      continue;
    }
    const dbT = String(fromDbMsg.text ?? '');
    const uiT = String(m.text ?? '');
    const dbEmpty = !dbT.trim();
    const dbCipher = dbT.startsWith('U2FsdGVkX1');
    const uiPlain = uiT.length > 0 && !uiT.startsWith('U2FsdGVkX1');
    if (uiPlain && (dbEmpty || dbCipher)) {
      byId.set(id, m);
    }
  }

  const merged = Array.from(byId.values()).sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });
  return trimMessagesToMax(merged);
}
