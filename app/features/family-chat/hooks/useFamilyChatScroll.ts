'use client';

import { useLayoutEffect } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { ChatUiMessage } from '@/lib/chat-messages';

interface UseFamilyChatScrollParams {
  messages: ChatUiMessage[];
  isAuthenticated: boolean;
  currentGroupId: string | null;
  chatBoxRef: RefObject<HTMLDivElement | null>;
  chatScrollRestoreRef: MutableRefObject<{ sh: number; st: number } | null>;
}

export function useFamilyChatScroll({
  messages,
  isAuthenticated,
  currentGroupId,
  chatBoxRef,
  chatScrollRestoreRef,
}: UseFamilyChatScrollParams) {
  useLayoutEffect(() => {
    const el = chatBoxRef.current;
    if (!el || !isAuthenticated) return;
    const p = chatScrollRestoreRef.current;
    if (p) {
      const delta = el.scrollHeight - p.sh;
      el.scrollTop = p.st + delta;
      chatScrollRestoreRef.current = null;
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [messages, isAuthenticated, chatBoxRef, chatScrollRestoreRef]);

  // 그룹 전환/초기 진입 시에는 항상 최신 메시지가 보이도록 하단으로 강제 이동
  useLayoutEffect(() => {
    const el = chatBoxRef.current;
    if (!el || !isAuthenticated || !currentGroupId) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [currentGroupId, isAuthenticated, chatBoxRef]);
}
