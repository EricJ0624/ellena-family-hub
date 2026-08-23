'use client';

import { useCallback } from 'react';
import {
  CHAT_PAGE_SIZE,
  formatFamilyMessagesFromRows,
  mergeChatMessagesWithExisting,
  type ChatMessageRow,
  type ChatUiMessage,
} from '@/lib/chat-messages';
import { DB_TABLES } from '@/lib/db-table-names';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';

interface UseFamilyChatInitialLoadParams {
  supabase: any;
  currentGroupId: string | null;
  setChatHasMoreOlder: React.Dispatch<React.SetStateAction<boolean>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatUiMessage[]>>;
}

async function fetchChatRows(supabase: any, groupId: string) {
  return supabase
    .from(DB_TABLES.FAMILY_MESSAGES)
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(CHAT_PAGE_SIZE);
}

export function useFamilyChatInitialLoad({
  supabase,
  currentGroupId,
  setChatHasMoreOlder,
  setMessages,
}: UseFamilyChatInitialLoadParams) {
  const loadInitialChatMessages = useCallback(
    async (currentKey: string) => {
      if (!currentGroupId) return;

      const session = await waitForSupabaseSession(supabase);
      if (!session?.access_token) {
        console.warn('[FamilyChat] 초기 로드: Supabase 세션이 준비되지 않았습니다.');
        return;
      }

      let messagesDataRaw: ChatMessageRow[] | null = null;
      let messagesError: { message?: string } | null = null;

      // 세션은 있는데 REST/RLS가 한 박자 늦는 경우 1회 재시도
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 450));
        }
        const res = await fetchChatRows(supabase, currentGroupId);
        messagesError = res.error;
        messagesDataRaw = (res.data as ChatMessageRow[] | null) ?? null;
        if (!messagesError) break;
      }

      if (messagesError) {
        console.error('[FamilyChat] 초기 메시지 로드 실패:', messagesError);
        return;
      }

      if (messagesDataRaw != null) {
        const chronological = messagesDataRaw.length > 0 ? [...messagesDataRaw].reverse() : [];
        const formattedMessages = formatFamilyMessagesFromRows(chronological, currentKey);
        setChatHasMoreOlder(messagesDataRaw.length >= CHAT_PAGE_SIZE);
        setMessages((prev) => mergeChatMessagesWithExisting(formattedMessages, prev));
      }
    },
    [currentGroupId, setChatHasMoreOlder, setMessages, supabase]
  );

  return {
    loadInitialChatMessages,
  };
}
