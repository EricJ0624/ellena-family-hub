'use client';

import { useEffect, useState } from 'react';
import { Camera, Mic, Paperclip, Send } from 'lucide-react';
import { KidsChatDecorations } from '@/app/features/family-chat/components/FamilyChatSection';
import { getCommonTranslation } from '@/lib/translations/common';
import { getDashboardTranslation } from '@/lib/translations/dashboard';
import { getFamilyRoleLabel } from '@/lib/translations/memberManagement';
import { getWidgetShowroomTranslation } from '@/lib/translations/widgetShowroom';
import type { LangCode } from '@/lib/language-fonts';

const RING = 'ring-2 ring-violet-500 ring-offset-1';

function TypedDraft({ text }: { text: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    const id = window.setInterval(() => {
      setCount((n) => (n >= text.length ? n : n + 1));
    }, 55);
    return () => window.clearInterval(id);
  }, [text]);

  return <>{text.slice(0, count)}</>;
}

/**
 * 채팅 쇼룸 미리보기. 실전송·첨부·할 일 추가는 하지 않고, 참고 영상 순서만 보여 준다.
 * 1 대화 확인 → 2 부탁 입력 → 3 전송 → 4 할 일·일정 칩 → 5 답장 입력 → 6 답장 표시
 */
export function ChatShowroomDemo({ lang, step }: { lang: LangCode; step: number }) {
  const dt = (key: Parameters<typeof getDashboardTranslation>[1]) => getDashboardTranslation(lang, key);
  const me = getCommonTranslation(lang, 'me');
  const dad = getFamilyRoleLabel(lang, 'dad');
  const welcome1 = getWidgetShowroomTranslation(lang, 'demo_chat_welcome_1');
  const welcome2 = getWidgetShowroomTranslation(lang, 'demo_chat_welcome_2');
  const request = getWidgetShowroomTranslation(lang, 'demo_chat_request');
  const reply = getWidgetShowroomTranslation(lang, 'demo_chat_reply');
  const typingRequest = step === 1;
  const typingReply = step === 4;
  const showRequest = step >= 2;
  const showChips = step >= 3;
  const showReply = step >= 5;
  const draft = typingRequest ? request : typingReply ? reply : '';
  const focusSend = typingRequest || typingReply;

  const messages: { user: string; time: string; text: string; mine: boolean; chips?: boolean }[] = [
    { user: me, time: '11:27', text: welcome1, mine: true },
    { user: me, time: '11:31', text: welcome2, mine: true },
    ...(showRequest
      ? [{ user: me, time: '11:38', text: request, mine: true, chips: showChips }]
      : []),
    ...(showReply
      ? [{ user: `👨 ${dad} (${me})`, time: '11:39', text: reply, mine: true }]
      : []),
  ];

  return (
    <div className="relative mx-auto w-full max-w-[22rem]">
      <section className="content-section chat-widget-section chat-widget-section--kids relative min-h-[16rem] overflow-hidden">
        <KidsChatDecorations />
        <div className="section-body chat-section-body relative z-[3] flex min-h-[16rem] flex-col">
          <div className="chat-messages min-h-0 flex-1 overflow-hidden">
            {messages.map((m, i) => (
              <div key={`${m.time}-${i}`} className="message-item">
                <div className="message-header">
                  <span className={`message-user${m.mine ? ' chat-kids-me' : ''}`}>{m.user}</span>
                  <span className="message-time">{m.time}</span>
                </div>
                <div className={`message-bubble ${step === 2 && i === 2 ? RING : ''}`}>
                  <p className="message-text">{m.text}</p>
                </div>
                {m.chips ? (
                  <div className={`mt-1.5 flex flex-wrap gap-1.5 rounded-xl p-0.5 ${step === 3 ? RING : ''}`}>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">
                      ✅ {dt('chat_quick_add_task')}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-semibold text-violet-800">
                      📅 {dt('chat_quick_add_calendar')}
                    </span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="chat-input-wrapper shrink-0 [gap:1.5cqmin]">
            <div className={`chat-kids-composer ${focusSend ? RING : ''}`}>
              <span className="chat-kids-mic" aria-hidden>
                <Mic className="chat-kids-mic-icon" />
              </span>
              <div className="chat-input min-w-0 flex-1 truncate text-left text-[12px] text-slate-800">
                {draft ? (
                  <TypedDraft text={draft} />
                ) : (
                  <span className="text-slate-400">{dt('chat_placeholder')}</span>
                )}
              </div>
              <div className="chat-attach-wrap">
                <button type="button" tabIndex={-1} className="chat-attach-btn" aria-hidden>
                  <Camera className="chat-attach-icon" aria-hidden />
                  <Paperclip className="chat-attach-icon" aria-hidden />
                </button>
              </div>
            </div>
            <div className="chat-kids-send-cluster">
              <button
                type="button"
                tabIndex={-1}
                className={`btn-send ${focusSend || step === 2 || step === 5 ? RING : ''}`}
                aria-hidden
              >
                {dt('chat_send')}
                <Send className="chat-kids-send-icon" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
