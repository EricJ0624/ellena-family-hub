/**
 * 가족 채팅(Family Chat) 섹션 컴포넌트
 */

'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { UploadedAttachment } from '@/lib/feature-attachments-client';
import { familyChatDebug } from '@/lib/family-chat-debug';
import type { ChatUiMessage } from '../types';

/** `public/images` 기준 말풍선 일러스트 — WebP 리사이즈본(용량 소) */
export const FAMILY_CHAT_BUBBLE_IMAGE_SRC = '/images/family-chat-hello-bubble.webp' as const;

/** 헤더 말풍선 박스 크기 — 한곳에서 조절 */
export const FAMILY_CHAT_BUBBLE_LAYOUT = {
  width: 'clamp(104px, 28vw, 176px)',
  height: 'clamp(80px, 21vw, 132px)',
} as const;

interface FamilyChatSectionProps {
  messages: ChatUiMessage[];
  userId: string;
  currentGroupId: string | null;
  /** 텍스트 전송 중 — 버튼·입력 잠금 (늦은 중복 전송·연타 완화) */
  isSendingText?: boolean;
  onSendMessage: (message: string) => void;
  chatBoxRef: React.RefObject<HTMLDivElement | null>;
  chatInputRef: React.RefObject<HTMLInputElement | null>;
  chatFileInputRef: React.RefObject<HTMLInputElement | null>;
  chatCameraInputRef: React.RefObject<HTMLInputElement | null>;
  chatHasMoreOlder: boolean;
  chatLoadingOlder: boolean;
  onLoadOlderMessages: () => void;
  onPickFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  chatAttachmentsByMessage: Record<string, UploadedAttachment[]>;
  chatOutgoingPreviews: Record<string, string[]>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  familyRoleByUserId: Record<string, 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null>;
  getFamilyRoleEmoji: (role: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null) => string;
  getFamilyRoleLabel: (lang: any, role: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null) => string;
  eventAuthorNames: Record<string, string>;
  lang: any;
  translations: {
    section_title_chat: string;
    section_chat_bubble_greeting: string;
    chat_placeholder: string;
    chat_send: string;
    chat_load_older: string;
    chat_loading_older: string;
    chat_album_btn: string;
    chat_camera_btn: string;
    chat_remove_attachment_aria: string;
    me: string;
    user: string;
  };
}

const BUBBLE_TEXT_MAX_PX = 22;
const BUBBLE_TEXT_MIN_PX = 7;

/** 다언어 섹션 타이틀: 너비에 맞게 축소, 높이·절대 상한 내에서 가능한 크게 */
const CHAT_TITLE_ABS_MAX_PX = 26;
const CHAT_TITLE_MIN_PX = 7;
const CHAT_TITLE_LINE_HEIGHT = 1.2;

export function FamilyChatSection({
  messages,
  userId,
  currentGroupId,
  isSendingText = false,
  onSendMessage,
  chatBoxRef,
  chatInputRef,
  chatFileInputRef,
  chatCameraInputRef,
  chatHasMoreOlder,
  chatLoadingOlder,
  onLoadOlderMessages,
  onPickFiles,
  chatAttachmentsByMessage,
  chatOutgoingPreviews,
  onDeleteAttachment,
  familyRoleByUserId,
  getFamilyRoleEmoji,
  getFamilyRoleLabel,
  eventAuthorNames,
  lang,
  translations: t,
}: FamilyChatSectionProps) {
  const chatHeaderRowRef = useRef<HTMLDivElement>(null);
  const chatTitleBoxRef = useRef<HTMLDivElement>(null);
  const chatTitleRef = useRef<HTMLHeadingElement>(null);
  const chatBubbleWrapRef = useRef<HTMLDivElement>(null);
  const chatBubbleTextBoxRef = useRef<HTMLDivElement>(null);
  const chatBubbleTextRef = useRef<HTMLSpanElement>(null);
  const [sectionTitleFontPx, setSectionTitleFontPx] = useState<number | null>(null);
  const [bubbleGreetingFontPx, setBubbleGreetingFontPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const row = chatHeaderRowRef.current;
    const box = chatTitleBoxRef.current;
    const el = chatTitleRef.current;
    if (!box || !el) return;

    const fitTitle = () => {
      const w = box.clientWidth;
      if (w <= 0) return;

      const rowH = row?.clientHeight ?? 0;
      const maxFromHeight =
        rowH > 0
          ? Math.min(
              CHAT_TITLE_ABS_MAX_PX,
              Math.max(12, Math.floor((rowH * 0.72) / CHAT_TITLE_LINE_HEIGHT))
            )
          : CHAT_TITLE_ABS_MAX_PX;

      let fs = maxFromHeight;
      el.style.fontSize = `${fs}px`;
      void el.offsetHeight;
      while (el.scrollWidth > w + 1 && fs > CHAT_TITLE_MIN_PX) {
        fs -= 0.5;
        el.style.fontSize = `${fs}px`;
        void el.offsetHeight;
      }
      setSectionTitleFontPx(fs);
    };

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(fitTitle);
    });
    if (row) ro.observe(row);
    ro.observe(box);
    fitTitle();
    requestAnimationFrame(() => requestAnimationFrame(fitTitle));
    void document.fonts.ready.then(() => requestAnimationFrame(fitTitle));

    return () => ro.disconnect();
  }, [t.section_title_chat, lang]);

  useLayoutEffect(() => {
    const wrap = chatBubbleWrapRef.current;
    const box = chatBubbleTextBoxRef.current;
    const textEl = chatBubbleTextRef.current;
    if (!wrap || !box || !textEl) return;

    const fit = () => {
      const bw = box.clientWidth;
      const bh = box.clientHeight;
      if (bw <= 0 || bh <= 0) return;

      let fs = BUBBLE_TEXT_MAX_PX;
      textEl.style.fontSize = `${fs}px`;
      void textEl.offsetHeight;
      while (
        (textEl.scrollWidth > bw + 1 || textEl.scrollHeight > bh + 1) &&
        fs > BUBBLE_TEXT_MIN_PX
      ) {
        fs -= 0.5;
        textEl.style.fontSize = `${fs}px`;
        void textEl.offsetHeight;
      }
      setBubbleGreetingFontPx(fs);
    };

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(fit);
    });
    ro.observe(wrap);
    ro.observe(box);
    fit();
    void document.fonts.ready.then(() => requestAnimationFrame(fit));

    return () => ro.disconnect();
  }, [t.section_chat_bubble_greeting, lang]);

  const handleSendClick = () => {
    if (isSendingText) return;
    const input = chatInputRef.current;
    if (!input || !input.value.trim()) {
      familyChatDebug('send skipped (empty input or missing ref)');
      return;
    }
    const text = input.value.trim();
    familyChatDebug('send click', { length: text.length });
    onSendMessage(text);
    input.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.repeat) return;
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;
    e.preventDefault();
    handleSendClick();
  };

  return (
    <section
      className="content-section px-[var(--spacing-lg)] py-[0.65rem]"
    >
      <div
        ref={chatHeaderRowRef}
        className="section-header mb-2 mt-0 items-center justify-start gap-[clamp(2px,1.2vw,8px)]"
      >
        <div
          ref={chatTitleBoxRef}
          className="flex min-w-0 flex-[1_1_0%] items-center self-stretch overflow-hidden"
        >
          <h3
            ref={chatTitleRef}
            className="section-title m-0 overflow-hidden text-ellipsis whitespace-nowrap tracking-[0.16em] leading-[1.2]"
            style={{
              fontSize:
                sectionTitleFontPx != null
                  ? `${sectionTitleFontPx}px`
                  : `${CHAT_TITLE_ABS_MAX_PX}px`,
            }}
          >
            {t.section_title_chat}
          </h3>
        </div>
        <div
          ref={chatBubbleWrapRef}
          className="relative shrink-0 -ml-1 -translate-y-[22px]"
          style={{
            width: FAMILY_CHAT_BUBBLE_LAYOUT.width,
            height: FAMILY_CHAT_BUBBLE_LAYOUT.height,
          }}
        >
          <Image
            src={FAMILY_CHAT_BUBBLE_IMAGE_SRC}
            alt=""
            fill
            sizes="(max-width: 768px) 28vw, 176px"
            className="object-contain object-center"
            priority={false}
          />
          <div
            ref={chatBubbleTextBoxRef}
            className="pointer-events-none absolute left-1/2 top-1/2 box-border flex h-[46%] max-h-full w-[82%] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden text-center"
          >
            <span
              ref={chatBubbleTextRef}
              className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-black tracking-[0.04em] text-orange-600 [line-height:1.05] [text-shadow:1.5px_0_0_#0f172a,-1.5px_0_0_#0f172a,0_1.5px_0_#0f172a,0_-1.5px_0_#0f172a,2px_2px_0_rgba(15,23,42,0.2)]"
              style={{
                fontSize: bubbleGreetingFontPx != null ? `${bubbleGreetingFontPx}px` : `${BUBBLE_TEXT_MAX_PX}px`,
              }}
            >
              {t.section_chat_bubble_greeting}
            </span>
          </div>
        </div>
      </div>
      <div className="section-body">
        <div ref={chatBoxRef} className="chat-messages">
          {chatHasMoreOlder && (
            <div className="px-0 pb-1 pt-2 text-center">
              <button
                type="button"
                onClick={onLoadOlderMessages}
                disabled={chatLoadingOlder}
                className="cursor-pointer rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-[13px] font-semibold text-indigo-600 disabled:cursor-wait disabled:opacity-75"
              >
                {chatLoadingOlder ? t.chat_loading_older : t.chat_load_older}
              </button>
            </div>
          )}
          {(messages || []).map((m) => (
            <div key={String(m.id)} className="message-item">
              <div className="message-header">
                <span className="message-user flex items-center gap-1">
                  {m.sender_id && familyRoleByUserId[m.sender_id] && (
                    <>
                      <span className="text-[20px] leading-none">
                        {getFamilyRoleEmoji(familyRoleByUserId[m.sender_id])}
                      </span>
                      <span className="text-[13px] font-semibold text-slate-500">
                        {getFamilyRoleLabel(lang, familyRoleByUserId[m.sender_id])}
                      </span>
                    </>
                  )}
                  <span>
                    {m.sender_id === userId
                      ? m.user === '나'
                        ? m.user
                        : t.me
                      : eventAuthorNames[m.sender_id!] ?? (m.user === '사용자' ? t.user : m.user)}
                  </span>
                </span>
                <span className="message-time">{m.time}</span>
              </div>
              <div className="message-bubble">
                {(() => {
                  const rows = chatAttachmentsByMessage[String(m.id)] || [];
                  const previews = chatOutgoingPreviews[String(m.id)] || [];
                  const showLocalPreviews = previews.length > 0 && rows.length === 0;
                  if (rows.length === 0 && !showLocalPreviews) return null;
                  return (
                    <div className="mb-2 grid grid-cols-3 gap-1.5">
                      {showLocalPreviews &&
                        previews.map((src, pi) => (
                          <div
                            key={`pv-${pi}`}
                            className="chat-attachment-cell relative"
                            title="업로드 중"
                          >
                            <img
                              src={src}
                              alt=""
                              className="h-[84px] w-full rounded-lg object-cover opacity-90"
                            />
                            <span
                              className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-slate-900/35 text-[11px] font-bold text-white"
                            >
                              …
                            </span>
                          </div>
                        ))}
                      {rows.map((att) => (
                        <div key={att.id} className="chat-attachment-cell relative">
                          <a href={att.image_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={att.thumbnail_url || att.image_url}
                              alt={att.original_filename}
                              className="h-[84px] w-full rounded-lg object-cover"
                            />
                          </a>
                          {m.sender_id === userId && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!currentGroupId) return;
                                void onDeleteAttachment(att.id);
                              }}
                              className="chat-attachment-delete-btn absolute right-1 top-1 h-[18px] w-[18px] cursor-pointer rounded-full border-none bg-red-500/95 p-0 text-[11px] leading-[18px] text-white"
                              aria-label={t.chat_remove_attachment_aria}
                            >
                              x
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {m.text && !String(m.text).startsWith('U2FsdGVkX1') && <p className="message-text">{m.text}</p>}
              </div>
            </div>
          ))}
        </div>
        <div className="chat-input-wrapper gap-1.5">
          <input
            ref={chatInputRef}
            type="text"
            aria-busy={isSendingText}
            onKeyDown={handleKeyDown}
            className={`chat-input min-w-0 flex-1 px-3 py-[11px] ${isSendingText ? 'opacity-[0.85]' : 'opacity-100'}`}
            placeholder={t.chat_placeholder}
          />
          <button
            type="button"
            onClick={handleSendClick}
            disabled={isSendingText}
            className={`btn-send px-3 py-2 text-xs ${isSendingText ? 'opacity-70' : 'opacity-100'}`}
          >
            {t.chat_send}
          </button>
          <button
            type="button"
            onClick={() => chatFileInputRef.current?.click()}
            className="cursor-pointer rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-[7px] text-xs font-semibold"
          >
            {t.chat_album_btn}
          </button>
          <button
            type="button"
            onClick={() => chatCameraInputRef.current?.click()}
            className="cursor-pointer rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-[7px] text-xs font-semibold"
          >
            {t.chat_camera_btn}
          </button>
          <input
            ref={chatFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            onChange={onPickFiles}
            className="hidden"
          />
          <input
            ref={chatCameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            capture="environment"
            onChange={onPickFiles}
            className="hidden"
          />
        </div>
      </div>
    </section>
  );
}
