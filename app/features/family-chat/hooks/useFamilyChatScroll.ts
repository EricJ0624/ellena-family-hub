'use client';

import { useLayoutEffect } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { ChatUiMessage } from '@/lib/chat-messages';

interface UseFamilyChatScrollParams {
  messages: ChatUiMessage[];
  isAuthenticated: boolean;
  chatBoxRef: RefObject<HTMLDivElement | null>;
  chatScrollRestoreRef: MutableRefObject<{ sh: number; st: number } | null>;
}

export function useFamilyChatScroll({
  messages,
  isAuthenticated,
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
}
