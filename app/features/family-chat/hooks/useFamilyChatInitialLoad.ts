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
        if (process.env.NODE_ENV === 'development') {
          console.warn('[FamilyChat] 초기 로드: Supabase 세션이 준비되지 않았습니다.');
        }
        return;
      }

      const { data: messagesDataRaw, error: messagesError } = await supabase
        .from(DB_TABLES.FAMILY_MESSAGES)
        .select('*')
        .eq('group_id', currentGroupId)
        .order('created_at', { ascending: false })
        .limit(CHAT_PAGE_SIZE);

      if (messagesError) {
        console.error('[FamilyChat] 초기 메시지 로드 실패:', messagesError);
        return;
      }

      if (messagesDataRaw != null) {
        const chronological = messagesDataRaw.length > 0 ? [...messagesDataRaw].reverse() : [];
        const formattedMessages = formatFamilyMessagesFromRows(chronological as ChatMessageRow[], currentKey);
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
