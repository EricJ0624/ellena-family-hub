/**
 * 가족 채팅(Family Chat) 비즈니스 로직 Hook
 */

'use client';

import { useEffect, useRef } from 'react';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { ChatUiMessage } from '../types';

interface UseFamilyChatProps {
  supabase: SupabaseClient;
  currentGroupId: string | null;
  userId: string;
  getCurrentKey: () => string;
  CryptoService: {
    encrypt: (data: any, key: string) => string;
    decrypt: (cipher: string, key: string) => any;
  };
  onMessagesChange: (messages: ChatUiMessage[]) => void;
  currentMessages: ChatUiMessage[];
  realtimeSubscriptionId: string;
}

export function useFamilyChat({
  supabase,
  currentGroupId,
  userId,
  getCurrentKey,
  CryptoService,
  onMessagesChange,
  currentMessages,
  realtimeSubscriptionId,
}: UseFamilyChatProps) {
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  // 초기 데이터 로드
  useEffect(() => {
    if (!currentGroupId || !userId) return;

    const loadMessages = async () => {
      try {
        const { data: messagesData, error: messagesError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('group_id', currentGroupId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (!messagesError && messagesData) {
          const currentKey = getCurrentKey();
          const formattedMessages: ChatUiMessage[] = messagesData.reverse().map((msg: any) => {
            let decryptedContent = msg.content || '';

            if (currentKey && msg.content && msg.content.startsWith('U2FsdGVkX1')) {
              try {
                const decrypted = CryptoService.decrypt(msg.content, currentKey);
                if (decrypted && typeof decrypted === 'string') {
                  decryptedContent = decrypted;
                }
              } catch (e) {
                console.error('메시지 복호화 실패:', e);
              }
            }

            const createdAt = new Date(msg.created_at);
            const timeStr = `${createdAt.getHours()}:${String(createdAt.getMinutes()).padStart(2, '0')}`;

            return {
              id: msg.id,
              user: '사용자',
              text: decryptedContent,
              time: timeStr,
              sender_id: msg.sender_id,
              created_at: msg.created_at,
            };
          });

          onMessagesChange(formattedMessages);
        }
      } catch (error) {
        console.error('채팅 메시지 로드 오류:', error);
      }
    };

    loadMessages();
  }, [currentGroupId, userId, supabase, getCurrentKey, CryptoService, onMessagesChange]);

  // Realtime 구독 설정
  useEffect(() => {
    if (!currentGroupId) return;

    // 기존 구독 정리
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }

    console.log('💬 채팅 subscription 설정 중...');
    const chatSubscription = supabase
      .channel(`chat_messages_changes:${currentGroupId}:${realtimeSubscriptionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, (payload: any) => {
        const ev = payload.eventType ?? (payload.old && !payload.new ? 'DELETE' : payload.new ? 'UPDATE' : 'INSERT');

        if (ev === 'DELETE') {
          const deletedMsg = payload.old;
          if (!deletedMsg?.id) return;
          const deletedIdStr = String(deletedMsg.id).trim().toLowerCase();

          onMessagesChange(
            currentMessages.filter((m) => {
              const mIdStr = String(m.id).trim().toLowerCase();
              return mIdStr !== deletedIdStr;
            })
          );
          return;
        }

        if (ev === 'UPDATE') {
          const updatedMsg = payload.new;
          if (!updatedMsg || !updatedMsg.id) return;
          if (updatedMsg.group_id !== currentGroupId) return;

          const currentKey = getCurrentKey();
          let decryptedContent = updatedMsg.content || '';

          if (currentKey && updatedMsg.content && updatedMsg.content.startsWith('U2FsdGVkX1')) {
            try {
              const decrypted = CryptoService.decrypt(updatedMsg.content, currentKey);
              if (decrypted && typeof decrypted === 'string') {
                decryptedContent = decrypted;
              }
            } catch (e) {
              console.error('메시지 복호화 실패:', e);
            }
          }

          const updatedCreatedAt = new Date(updatedMsg.created_at);
          const updatedTimeStr = `${updatedCreatedAt.getHours()}:${String(updatedCreatedAt.getMinutes()).padStart(2, '0')}`;

          onMessagesChange(
            currentMessages.map((m) =>
              m.id === updatedMsg.id
                ? {
                    id: updatedMsg.id,
                    user: '사용자',
                    text: decryptedContent,
                    time: updatedTimeStr,
                    sender_id: updatedMsg.sender_id,
                    created_at: updatedMsg.created_at,
                  }
                : m
            )
          );
          return;
        }

        // INSERT
        const newMsg = payload.new;
        if (!newMsg || !newMsg.id) return;
        if (newMsg.group_id !== currentGroupId) return;

        // 자신이 보낸 메시지는 중복 방지
        if (newMsg.sender_id === userId) {
          const existingById = currentMessages.find((m) => String(m.id) === String(newMsg.id));
          if (existingById) return;
        }

        // 새 메시지 추가
        const currentKey = getCurrentKey();
        let decryptedContent = newMsg.content || '';

        if (currentKey && newMsg.content && newMsg.content.startsWith('U2FsdGVkX1')) {
          try {
            const decrypted = CryptoService.decrypt(newMsg.content, currentKey);
            if (decrypted && typeof decrypted === 'string') {
              decryptedContent = decrypted;
            }
          } catch (e) {
            console.error('메시지 복호화 실패:', e);
          }
        }

        const finalCreatedAt = new Date(newMsg.created_at);
        const finalTimeStr = `${finalCreatedAt.getHours()}:${String(finalCreatedAt.getMinutes()).padStart(2, '0')}`;

        onMessagesChange([
          ...currentMessages,
          {
            id: newMsg.id,
            user: '사용자',
            text: decryptedContent,
            time: finalTimeStr,
            sender_id: newMsg.sender_id,
            created_at: newMsg.created_at,
          },
        ]);
      })
      .subscribe((status, err) => {
        console.log('💬 Realtime 채팅 subscription 상태:', status);
        if (err) {
          console.error('❌ Realtime 채팅 subscription 오류:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime 채팅 subscription 연결 성공');
          subscriptionRef.current = chatSubscription;
        }
      });

    return () => {
      if (subscriptionRef.current === chatSubscription) {
        subscriptionRef.current = null;
      }
      void supabase.removeChannel(chatSubscription);
    };
  }, [currentGroupId, userId, supabase, realtimeSubscriptionId, getCurrentKey, CryptoService, onMessagesChange, currentMessages]);

  // 메시지 전송
  const sendMessage = async (content: string) => {
    if (!content.trim() || !currentGroupId) return;

    const currentKey = getCurrentKey();
    const encryptedContent = CryptoService.encrypt(content, currentKey);

    const { error } = await supabase.from('chat_messages').insert({
      group_id: currentGroupId,
      sender_id: userId,
      content: encryptedContent,
      type: 'text',
    });

    if (error) {
      console.error('채팅 메시지 저장 오류:', error);
      throw error;
    }
  };

  return {
    sendMessage,
  };
}
