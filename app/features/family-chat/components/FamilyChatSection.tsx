/**
 * 가족 채팅(Family Chat) 섹션 컴포넌트
 */

'use client';

import { Camera, ImageIcon, Paperclip } from 'lucide-react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { UploadedAttachment } from '@/lib/feature-attachments-client';
import { familyChatDebug } from '@/lib/family-chat-debug';
import type { ChatUiMessage } from '../types';

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
    chat_attach_btn_aria: string;
    chat_remove_attachment_aria: string;
    me: string;
    user: string;
  };
}

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
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const [sectionTitleFontPx, setSectionTitleFontPx] = useState<number | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);

  useEffect(() => {
    if (!attachMenuOpen) return;
    const closeOnOutside = (e: PointerEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAttachMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [attachMenuOpen]);

  const openAlbumPicker = () => {
    setAttachMenuOpen(false);
    chatFileInputRef.current?.click();
  };

  const openCameraPicker = () => {
    setAttachMenuOpen(false);
    chatCameraInputRef.current?.click();
  };

  useLayoutEffect(() => {
    const row = chatHeaderRowRef.current;
    const box = chatTitleBoxRef.current;
    const el = chatTitleRef.current;
    if (!box || !el) return;

    const fitTitle = () => {
      const w = box.clientWidth;
      if (w <= 0) return;

      // hello 말풍선 제거 후 row 높이가 작아져 타이틀이 과도하게 축소되는 문제를 방지
      let fs = CHAT_TITLE_ABS_MAX_PX;
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
      className="content-section"
      style={{ paddingLeft: '4cqmin', paddingRight: '4cqmin', paddingTop: '2cqmin', paddingBottom: '2cqmin' }}
    >
      <div
        ref={chatHeaderRowRef}
        className="section-header mt-0 items-center justify-start"
        style={{ marginBottom: '2cqmin' }}
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
      </div>
      <div className="section-body">
        <div ref={chatBoxRef} className="chat-messages">
          {chatHasMoreOlder && (
            <div className="text-center" style={{ padding: '2cqmin 0 1cqmin' }}>
              <button
                type="button"
                onClick={onLoadOlderMessages}
                disabled={chatLoadingOlder}
                className="cursor-pointer rounded-full border border-indigo-200 bg-indigo-50 font-semibold text-indigo-600 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:cursor-wait disabled:opacity-75"
                style={{ padding: '1.5cqmin 3.5cqmin', fontSize: '4cqmin' }}
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
                      <span style={{ fontSize: '6cqmin', lineHeight: 1 }}>
                        {getFamilyRoleEmoji(familyRoleByUserId[m.sender_id])}
                      </span>
                      <span className="font-semibold text-slate-500" style={{ fontSize: '3cqmin' }}>
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
                    <div className="grid grid-cols-3" style={{ marginBottom: '2cqmin', gap: '1.5cqmin' }}>
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
                              className="w-full rounded-lg object-cover opacity-90"
                              style={{ height: '20cqmin' }}
                            />
                            <span
                              className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-slate-900/35 font-bold text-white"
                              style={{ fontSize: '4cqmin' }}
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
                              className="w-full rounded-lg object-cover"
                              style={{ height: '20cqmin' }}
                            />
                          </a>
                          {m.sender_id === userId && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!currentGroupId) return;
                                void onDeleteAttachment(att.id);
                              }}
                              className="chat-attachment-delete-btn absolute right-1 top-1 cursor-pointer rounded-full border-none bg-red-500/95 p-0 font-bold leading-none text-white transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
                              style={{ width: '5cqmin', height: '5cqmin', fontSize: '3cqmin' }}
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
        <div className="chat-input-wrapper" style={{ gap: '1.5cqmin' }}>
          <input
            ref={chatInputRef}
            type="text"
            aria-busy={isSendingText}
            onKeyDown={handleKeyDown}
            className={`chat-input min-w-0 flex-1 ${isSendingText ? 'opacity-[0.85]' : 'opacity-100'}`}
            placeholder={t.chat_placeholder}
          />
          <div ref={attachMenuRef} className="chat-attach-wrap">
            <button
              type="button"
              onClick={() => setAttachMenuOpen((open) => !open)}
              className="chat-attach-btn"
              aria-label={t.chat_attach_btn_aria}
              aria-expanded={attachMenuOpen}
              aria-haspopup="menu"
            >
              <Camera className="chat-attach-icon" aria-hidden />
              <Paperclip className="chat-attach-icon" aria-hidden />
            </button>
            {attachMenuOpen && (
              <div role="menu" className="chat-attach-menu">
                <button
                  type="button"
                  role="menuitem"
                  className="chat-attach-menu-item"
                  onClick={openAlbumPicker}
                >
                  <ImageIcon className="chat-attach-menu-icon" aria-hidden />
                  <span>{t.chat_album_btn}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="chat-attach-menu-item"
                  onClick={openCameraPicker}
                >
                  <Camera className="chat-attach-menu-icon" aria-hidden />
                  <span>{t.chat_camera_btn}</span>
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleSendClick}
            disabled={isSendingText}
            className={`btn-send ${isSendingText ? 'opacity-70' : 'opacity-100'}`}
          >
            {t.chat_send}
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
