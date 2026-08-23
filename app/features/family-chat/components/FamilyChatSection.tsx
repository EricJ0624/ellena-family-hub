/**
 * 가족 채팅(Family Chat) 섹션 컴포넌트
 */

'use client';

import { Camera, ImageIcon, Mic, Paperclip, Plus, Send } from 'lucide-react';
import React, { memo, useEffect, useRef, useState } from 'react';
import type { UploadedAttachment } from '@/lib/feature-attachments-client';
import { familyChatDebug } from '@/lib/family-chat-debug';
import type { UiTheme } from '@/lib/ui-theme';
import type { ChatUiMessage } from '../types';
import { getChatMessageDisplayText } from '@/lib/chat-messages';

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
  uiTheme?: UiTheme;
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

const KIDS_CHAT_DECOS: { src: string; className: string; overChat?: boolean }[] = [
  { src: '/family-calendar/emojis/earth.png', className: 'top-[2%] left-[1.5%] w-[12%]' },
  { src: '/family-calendar/emojis/planet.png', className: 'top-[2%] right-[3%] w-[13%]' },
  { src: '/family-calendar/add-emojis/moon.png', className: 'top-[16%] right-[0.5%] w-[8%]' },
  { src: '/family-calendar/emojis/star.png', className: 'top-[1%] left-[26%] w-[5%]' },
  { src: '/family-calendar/emojis/star.png', className: 'top-[0.4%] left-[48%] w-[4.5%] rotate-12' },
  { src: '/family-calendar/emojis/star.png', className: 'top-[1%] right-[28%] w-[5%] -rotate-6' },
  { src: '/family-chat/emojis/shooting-star.png', className: 'top-[7%] left-[10%] w-[12%] -rotate-12' },
  { src: '/family-calendar/emojis/firework.png', className: 'top-[5.5%] left-[20%] w-[8%]' },
  { src: '/family-calendar/emojis/firework-2.png', className: 'top-[5.5%] right-[16%] w-[8%]' },
  { src: '/family-chat/emojis/ghosts.png?v=3', className: 'top-[26%] left-[6%] w-[26%]', overChat: true },
  { src: '/family-chat/emojis/cake.png', className: 'top-[30%] right-[16%] w-[8%]', overChat: true },
  { src: '/family-chat/emojis/balloon.png', className: 'top-[38%] right-[2%] w-[8%]' },
  { src: '/family-chat/emojis/book.png', className: 'top-[44%] left-[1.5%] w-[8%] -rotate-12', overChat: true },
  { src: '/family-chat/emojis/dining-set.png', className: 'top-[68%] right-[2%] w-[7.5%]' },
  { src: '/family-chat/emojis/pizza.png', className: 'top-[50%] right-[20%] w-[8%]', overChat: true },
  { src: '/family-chat/emojis/broccoli.png', className: 'top-[52%] right-[10%] w-[7%]' },
  { src: '/family-chat/emojis/bicycle.png', className: 'bottom-[16%] left-[18%] w-[10%]', overChat: true },
  { src: '/family-chat/emojis/music.png', className: 'bottom-[13%] left-[6%] w-[7%]', overChat: true },
  { src: '/family-calendar/emojis/palette.png', className: 'bottom-[11%] left-[30%] w-[7%]', overChat: true },
  { src: '/family-calendar/emojis/stroller.png', className: 'bottom-[15%] right-[38%] w-[8%]', overChat: true },
  { src: '/family-chat/emojis/dog.png', className: 'bottom-[1%] left-[0.5%] w-[12%]' },
  { src: '/family-chat/emojis/smoke.png', className: 'bottom-[1.5%] right-[18%] w-[10%]' },
];

export const KidsChatDecorations = memo(function KidsChatDecorations() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-transparent" aria-hidden>
      {KIDS_CHAT_DECOS.map((item, index) => (
        <img
          key={`${item.src}-${index}`}
          src={item.src}
          alt=""
          className={`chat-kids-deco absolute bg-transparent object-contain${item.overChat ? ' chat-kids-deco--over-chat' : ''} ${item.className}`}
        />
      ))}
    </div>
  );
});

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
  uiTheme,
  translations: t,
}: FamilyChatSectionProps) {
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const isKidsTheme = uiTheme === 'kids_friendly';

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

  const attachControls = (
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
  );

  const inputField = (
    <input
      ref={chatInputRef}
      type="text"
      aria-busy={isSendingText}
      onKeyDown={handleKeyDown}
      className={`chat-input min-w-0 flex-1 ${isSendingText ? 'opacity-[0.85]' : 'opacity-100'}`}
      placeholder={t.chat_placeholder}
    />
  );

  return (
    <section
      className={`content-section chat-widget-section${isKidsTheme ? ' chat-widget-section--kids' : ''}`}
    >
      {isKidsTheme ? <KidsChatDecorations /> : null}
      <div className="section-header chat-section-header relative z-[3]">
        {isKidsTheme ? (
          <>
            <h3 className="sr-only">{t.section_title_chat}</h3>
            <img src="/family-chat/title.png" alt="" className="chat-kids-title" />
          </>
        ) : (
          <h3 className="section-title">{t.section_title_chat}</h3>
        )}
      </div>
      <div className="section-body chat-section-body relative z-[3]">
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
                  <span className={isKidsTheme && m.sender_id === userId ? 'chat-kids-me' : undefined}>
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
                {m.text && (
                  <p className="message-text">
                    {getChatMessageDisplayText(
                      String(m.text),
                      lang === 'en' ? 'Unable to load message' : '메시지를 불러올 수 없습니다',
                    )}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="chat-input-wrapper" style={{ gap: '1.5cqmin' }}>
          {isKidsTheme ? (
            <div className="chat-kids-composer">
              <span className="chat-kids-mic" aria-hidden>
                <Mic className="chat-kids-mic-icon" />
              </span>
              {inputField}
              <span className="chat-kids-add" aria-hidden>
                <Plus className="chat-kids-add-plus" />
                <span className="chat-kids-add-label">Add</span>
              </span>
              {attachControls}
            </div>
          ) : (
            <>
              {inputField}
              {attachControls}
            </>
          )}
          <div className={isKidsTheme ? 'chat-kids-send-cluster' : undefined}>
            <button
              type="button"
              onClick={handleSendClick}
              disabled={isSendingText}
              className={`btn-send ${isSendingText ? 'opacity-70' : 'opacity-100'}`}
            >
              {t.chat_send}
              {isKidsTheme ? <Send className="chat-kids-send-icon" aria-hidden /> : null}
            </button>
            {isKidsTheme ? (
              <img src="/family-chat/emojis/rocket.png" alt="" className="chat-kids-rocket" aria-hidden />
            ) : null}
          </div>
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
