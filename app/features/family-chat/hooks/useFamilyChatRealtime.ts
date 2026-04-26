'use client';

import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import { trimMessagesToMax, type ChatUiMessage } from '@/lib/chat-messages';
import { getAttachmentsForEntity } from '@/lib/feature-attachments-client';
import { familyChatDebug } from '@/lib/family-chat-debug';
import { DB_TABLES } from '@/lib/db-table-names';

interface UseFamilyChatRealtimeParams {
  supabase: any;
  currentGroupId: string | null;
  realtimeSubscriptionIdRef: MutableRefObject<string | number>;
  dashboardCurrentGroupIdRef: MutableRefObject<string | null>;
  dashboardUserIdRef: MutableRefObject<string>;
  processedMessageIdsRef: MutableRefObject<Set<string>>;
  chatAttachmentsDebounceTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  loadChatAttachmentsRef: MutableRefObject<() => Promise<void>>;
  subscriptionsRef: MutableRefObject<{
    messages: any;
    attachments: any;
  }>;
  getCurrentKey: () => string;
  decrypt: (cipher: string, key: string) => any;
  setMessages: React.Dispatch<React.SetStateAction<ChatUiMessage[]>>;
}

export function useFamilyChatRealtime({
  supabase,
  currentGroupId,
  realtimeSubscriptionIdRef,
  dashboardCurrentGroupIdRef,
  dashboardUserIdRef,
  processedMessageIdsRef,
  chatAttachmentsDebounceTimerRef,
  loadChatAttachmentsRef,
  subscriptionsRef,
  getCurrentKey,
  decrypt,
  setMessages,
}: UseFamilyChatRealtimeParams) {
  const scheduleLoadChatAttachments = useCallback(() => {
    if (chatAttachmentsDebounceTimerRef.current) {
      clearTimeout(chatAttachmentsDebounceTimerRef.current);
    }
    chatAttachmentsDebounceTimerRef.current = setTimeout(() => {
      chatAttachmentsDebounceTimerRef.current = null;
      void loadChatAttachmentsRef.current();
    }, 280);
  }, [chatAttachmentsDebounceTimerRef, loadChatAttachmentsRef]);

  const pollIncomingChatPhotos = useCallback(
    (messageId: string) => {
      const gid = currentGroupId;
      if (!gid) return;
      let attempts = 0;
      const maxAttempts = 14;
      const run = () => {
        if (attempts >= maxAttempts) return;
        attempts += 1;
        void getAttachmentsForEntity({
          groupId: gid,
          entityType: 'chat_message',
          entityId: messageId,
        })
          .then((atts) => {
            if (atts.length > 0) {
              void loadChatAttachmentsRef.current();
              return;
            }
            setTimeout(run, 380);
          })
          .catch(() => setTimeout(run, 380));
      };
      setTimeout(run, 200);
    },
    [currentGroupId, loadChatAttachmentsRef]
  );

  const setupMessagesAndAttachmentsSubscription = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (subscriptionsRef.current.messages) {
      supabase.removeChannel(subscriptionsRef.current.messages);
      subscriptionsRef.current.messages = null;
    }

    const channelName = `${DB_TABLES.FAMILY_MESSAGES}_changes:${currentGroupId ?? 'none'}:${realtimeSubscriptionIdRef.current}`;
    familyChatDebug('메시지 subscription 설정', channelName);
    const messagesSubscription = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: DB_TABLES.FAMILY_MESSAGES }, (payload: any) => {
        const ev = payload.eventType ?? (payload.old && !payload.new ? 'DELETE' : payload.new ? 'UPDATE' : 'INSERT');
        if (ev === 'DELETE') {
          const deletedMessage = payload.old;
          const deletedId = deletedMessage?.id;
          if (!deletedId) return;
          const gid = dashboardCurrentGroupIdRef.current;
          if (deletedMessage?.group_id != null && deletedMessage.group_id !== gid) return;
          const deletedIdStr = String(deletedId).trim();
          setMessages((prev) => prev.filter((m) => String(m.id).trim() !== deletedIdStr));
          return;
        }

        if (ev === 'UPDATE') {
          const updatedMessage = payload.new;
          const gid = dashboardCurrentGroupIdRef.current;
          if (updatedMessage.group_id != null && updatedMessage.group_id !== gid) return;
          const messageText = updatedMessage.message_text || '';
          let decryptedText = messageText;
          const updateMessageKey = getCurrentKey();
          if (updateMessageKey && messageText && messageText.startsWith('U2FsdGVkX1')) {
            try {
              const decryptedValue = decrypt(messageText, updateMessageKey);
              if (typeof decryptedValue === 'string') decryptedText = decryptedValue;
            } catch (_) {}
          }
          const timeStr = `${new Date(updatedMessage.created_at).getHours()}:${String(
            new Date(updatedMessage.created_at).getMinutes()
          ).padStart(2, '0')}`;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updatedMessage.id
                ? {
                    id: updatedMessage.id,
                    user: '사용자',
                    text: decryptedText,
                    time: timeStr,
                    sender_id: updatedMessage.sender_id,
                    created_at: updatedMessage.created_at,
                  }
                : m
            )
          );
          return;
        }

        const newMessage = payload.new;
        if (!newMessage || !newMessage.id) return;
        const insertGid = dashboardCurrentGroupIdRef.current;
        if (newMessage.group_id != null && newMessage.group_id !== insertGid) return;

        const messageId = String(newMessage.id);
        const uidForChat = dashboardUserIdRef.current;
        const isOwnMessage =
          newMessage.sender_id != null && uidForChat !== '' && String(newMessage.sender_id) === String(uidForChat);

        familyChatDebug('Realtime INSERT', {
          messageId,
          sender: newMessage.sender_id,
          currentUser: uidForChat,
          subscriptionId: realtimeSubscriptionIdRef.current,
          alreadyProcessed: processedMessageIdsRef.current.has(messageId),
          isOwnMessage,
        });

        if (isOwnMessage) {
          setMessages((prev) => {
            if (prev.some((m) => String(m.id) === messageId)) return prev;
            const messageText = newMessage.message_text || '';
            let decryptedText = messageText;
            const messageKey = getCurrentKey();
            if (messageKey && messageText && messageText.startsWith('U2FsdGVkX1')) {
              try {
                const decryptedValue = decrypt(messageText, messageKey);
                if (typeof decryptedValue === 'string') decryptedText = decryptedValue;
              } catch (_) {}
            }
            const createdAt = new Date(newMessage.created_at);
            const timeStr = `${createdAt.getHours()}:${String(createdAt.getMinutes()).padStart(2, '0')}`;
            familyChatDebug('본인 메시지 Realtime state 복구', messageId);
            return trimMessagesToMax([
              ...prev,
              {
                id: newMessage.id,
                user: '나',
                text: decryptedText,
                time: timeStr,
                sender_id: newMessage.sender_id,
                created_at: newMessage.created_at,
              },
            ]);
          });
          return;
        }

        if (processedMessageIdsRef.current.has(messageId)) {
          if (
            newMessage.sender_id != null &&
            uidForChat !== '' &&
            String(newMessage.sender_id) === String(uidForChat)
          ) {
            setMessages((prev) => {
              if (prev.some((m) => String(m.id) === messageId)) return prev;
              const messageText = newMessage.message_text || '';
              let decryptedText = messageText;
              const messageKey = getCurrentKey();
              if (messageKey && messageText && messageText.startsWith('U2FsdGVkX1')) {
                try {
                  const decryptedValue = decrypt(messageText, messageKey);
                  if (typeof decryptedValue === 'string') decryptedText = decryptedValue;
                } catch (_) {}
              }
              const createdAt = new Date(newMessage.created_at);
              const timeStr = `${createdAt.getHours()}:${String(createdAt.getMinutes()).padStart(2, '0')}`;
              familyChatDebug('본인 메시지(processed) Realtime 복구', messageId);
              return trimMessagesToMax([
                ...prev,
                {
                  id: newMessage.id,
                  user: '나',
                  text: decryptedText,
                  time: timeStr,
                  sender_id: newMessage.sender_id,
                  created_at: newMessage.created_at,
                },
              ]);
            });
            return;
          }
          familyChatDebug('이미 처리된 메시지 ID 무시', messageId);
          return;
        }

        processedMessageIdsRef.current.add(messageId);
        familyChatDebug('메시지 ID 마킹 완료', messageId);
        if (processedMessageIdsRef.current.size > 100) {
          const arr = Array.from(processedMessageIdsRef.current);
          processedMessageIdsRef.current = new Set(arr.slice(-100));
        }

        familyChatDebug('새 메시지 Realtime 처리', messageId, 'sender:', newMessage.sender_id);
        const messageText = newMessage.message_text || '';
        let decryptedText = messageText;
        const messageKey = getCurrentKey();
        if (messageKey && messageText && messageText.startsWith('U2FsdGVkX1')) {
          try {
            const decryptedValue = decrypt(messageText, messageKey);
            if (typeof decryptedValue === 'string') decryptedText = decryptedValue;
          } catch (_) {}
        }
        const createdAt = new Date(newMessage.created_at);
        const timeStr = `${createdAt.getHours()}:${String(createdAt.getMinutes()).padStart(2, '0')}`;

        setMessages((prev) => {
          const existingMessage = prev.find((m) => String(m.id) === messageId);
          if (existingMessage) {
            familyChatDebug('State에 이미 존재하는 메시지 무시', messageId);
            return prev;
          }
          familyChatDebug('State에 메시지 추가', messageId, 'len:', String(decryptedText).length, 'count:', prev.length);
          return trimMessagesToMax([
            ...prev,
            {
              id: newMessage.id,
              user: '사용자',
              text: decryptedText,
              time: timeStr,
              sender_id: newMessage.sender_id,
              created_at: newMessage.created_at,
            },
          ]);
        });

        if (!String(decryptedText || '').trim()) {
          scheduleLoadChatAttachments();
          pollIncomingChatPhotos(messageId);
        }
      })
      .subscribe((status: string, err: unknown) => {
        familyChatDebug('Realtime 메시지 subscription 상태', status, channelName);
        if (err) {
          console.error('[FamilyChat] Realtime 메시지 subscription 오류:', err);
        }
        if (status === 'SUBSCRIBED') {
          familyChatDebug('Realtime 메시지 subscription 연결됨');
          subscriptionsRef.current.messages = messagesSubscription;
          const activeChannels = supabase.getChannels();
          const messageChannels = activeChannels.filter((ch: any) => ch.topic.includes(DB_TABLES.FAMILY_MESSAGES));
          familyChatDebug('활성 채널 수', activeChannels.length, `${DB_TABLES.FAMILY_MESSAGES} 채널 수`, messageChannels.length);
          if (messageChannels.length > 1) {
            console.error('[FamilyChat] 메시지 Realtime 채널 중복:', messageChannels.map((ch: any) => ch.topic));
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[FamilyChat] Realtime 메시지 subscription 비정상:', status);
        }
      });

    familyChatDebug('첨부 파일 subscription 설정');
    if (subscriptionsRef.current.attachments) {
      supabase.removeChannel(subscriptionsRef.current.attachments);
      subscriptionsRef.current.attachments = null;
    }
    const attachmentsSubscription = supabase
      .channel(`${DB_TABLES.ATTACHMENTS}_changes:${currentGroupId ?? 'none'}:${realtimeSubscriptionIdRef.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: DB_TABLES.ATTACHMENTS }, (payload: any) => {
        const ev = payload.eventType ?? (payload.old && !payload.new ? 'DELETE' : payload.new ? 'UPDATE' : 'INSERT');
        const record = payload.new || payload.old;
        if (!record) return;
        if (record.group_id != null && record.group_id !== currentGroupId) return;
        if (record.feature_type !== 'chat' || record.entity_type !== 'chat_message') return;
        if (ev === 'INSERT' || ev === 'DELETE') {
          scheduleLoadChatAttachments();
        }
      })
      .subscribe((status: string, err: unknown) => {
        familyChatDebug('Realtime 첨부 subscription 상태', status);
        if (err) {
          console.error('[FamilyChat] Realtime 첨부 subscription 오류:', err);
        }
        if (status === 'SUBSCRIBED') {
          familyChatDebug('Realtime 첨부 subscription 연결됨');
          subscriptionsRef.current.attachments = attachmentsSubscription;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[FamilyChat] Realtime 첨부 subscription 비정상:', status);
        }
      });
  }, [
    supabase,
    currentGroupId,
    realtimeSubscriptionIdRef,
    dashboardCurrentGroupIdRef,
    dashboardUserIdRef,
    processedMessageIdsRef,
    getCurrentKey,
    decrypt,
    setMessages,
    subscriptionsRef,
    scheduleLoadChatAttachments,
    pollIncomingChatPhotos,
  ]);

  const clearChatRuntimeState = useCallback(() => {
    if (chatAttachmentsDebounceTimerRef.current) {
      clearTimeout(chatAttachmentsDebounceTimerRef.current);
      chatAttachmentsDebounceTimerRef.current = null;
    }
    processedMessageIdsRef.current.clear();
  }, [chatAttachmentsDebounceTimerRef, processedMessageIdsRef]);

  return {
    setupMessagesAndAttachmentsSubscription,
    clearChatRuntimeState,
  };
}
