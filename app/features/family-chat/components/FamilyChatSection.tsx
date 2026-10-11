/**
 * 가족 채팅(Family Chat) 섹션 컴포넌트
 */

'use client';

import { Camera, ImageIcon, Mic, Paperclip, Send } from 'lucide-react';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { UploadedAttachment } from '@/lib/feature-attachments-client';
import { familyChatDebug } from '@/lib/family-chat-debug';
import type { UiTheme } from '@/lib/ui-theme';
import type { ChatUiMessage } from '../types';
import {
  getChatMessageDisplayText,
  isChatCipherText,
  listUnreadChatMessages,
  summarizeUnreadChatBySender,
  type UnreadChatSenderSummary,
} from '@/lib/chat-messages';

const EMPTY_UNREAD_SUMMARY: UnreadChatSenderSummary[] = [];
import { getCommonTranslation } from '@/lib/translations/common';
import { isValidLang } from '@/lib/language-fonts';

interface FamilyChatSectionProps {
  messages: ChatUiMessage[];
  userId: string;
  currentGroupId: string | null;
  /** 텍스트 전송 중 — 버튼·입력 잠금 (늦은 중복 전송·연타 완화) */
  isSendingText?: boolean;
  onSendMessage: (message: string) => void;
  /** M 이상 칸에서 입력칸 포커스 시 대화 화면을 연다. S 칸 돋보기와는 별개. */
  onInputFocus?: () => void;
  /** 대화 화면(큰 창)일 때만 글자·입력·버튼을 키운다. */
  roomMode?: boolean;
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
  /** 채팅 메시지 텍스트를 제목으로 할 일 모달 열기 (FamilyTasksSection.openFromChatRef 경유) */
  onOpenTaskWithText?: (text: string) => void;
  /** 채팅 메시지 텍스트를 제목으로 캘린더 모달 열기 (FamilyCalendarSection.openFromChatRef 경유) */
  onOpenCalendarWithText?: (text: string) => void;
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
    chat_quick_add_task: string;
    chat_quick_add_calendar: string;
    chat_task_added_ok: string;
    chat_task_add_failed: string;
    chat_unread_summary_btn: string;
    chat_unread_dismiss: string;
    chat_unread_badge: string;
    chat_unread_summary_title: string;
    chat_unread_mark_all: string;
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

export const FamilyChatSection = memo(function FamilyChatSection({
  messages,
  userId,
  currentGroupId,
  isSendingText = false,
  onSendMessage,
  onInputFocus,
  roomMode = false,
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
  onOpenTaskWithText,
  onOpenCalendarWithText,
  translations: t,
}: FamilyChatSectionProps) {
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const isKidsTheme = uiTheme === 'kids_friendly';

  // ── 안 읽은 메시지 추적 ──────────────────────────────────────────
  const storageKey = userId && currentGroupId
    ? `family_chat_last_seen:${userId}:${currentGroupId}`
    : null;

  const [unreadCount, setUnreadCount] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  /** 모바일 탭으로 연 메시지 액션. PC는 hover로도 보임. */
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const didInitSeenRef = useRef(false);
  const roomModePrevRef = useRef(roomMode);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const unavailableLabel = lang === 'en' ? 'Unable to load message' : '메시지를 불러올 수 없습니다';

  const setUnreadCountIfChanged = (next: number) => {
    setUnreadCount((prev) => (prev === next ? prev : next));
  };

  const hideSummaryIfOpen = () => {
    setShowSummary((prev) => (prev ? false : prev));
  };

  const markLatestSeen = () => {
    if (!storageKey) return;
    const latest = messagesRef.current.length
      ? messagesRef.current[messagesRef.current.length - 1]?.created_at
      : null;
    if (latest) localStorage.setItem(storageKey, latest);
    setUnreadCountIfChanged(0);
    hideSummaryIfOpen();
  };

  useEffect(() => {
    didInitSeenRef.current = false;
    hideSummaryIfOpen();
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !messages.length) {
      setUnreadCountIfChanged(0);
      return;
    }
    if (!didInitSeenRef.current) {
      didInitSeenRef.current = true;
      if (!localStorage.getItem(storageKey)) {
        const latest = messages[messages.length - 1]?.created_at;
        if (latest) localStorage.setItem(storageKey, latest);
        setUnreadCountIfChanged(0);
        return;
      }
    }
    const lastSeenAt = localStorage.getItem(storageKey);
    setUnreadCountIfChanged(listUnreadChatMessages(messages, userId, lastSeenAt).length);
  }, [messages, storageKey, userId]);

  // 대화 화면을 닫을 때만 읽음 처리 — messages deps에 넣으면 수신마다 effect가 돈다
  useEffect(() => {
    const wasOpen = roomModePrevRef.current;
    roomModePrevRef.current = roomMode;
    if (wasOpen && !roomMode) markLatestSeen();
  }, [roomMode, storageKey]);

  const unreadSummary = useMemo(() => {
    if (!showSummary || !storageKey) return EMPTY_UNREAD_SUMMARY;
    const unread = listUnreadChatMessages(messages, userId, localStorage.getItem(storageKey));
    return summarizeUnreadChatBySender(unread, eventAuthorNames, (text) =>
      getChatMessageDisplayText(text, unavailableLabel),
    );
  }, [showSummary, messages, storageKey, userId, eventAuthorNames, unavailableLabel]);

  useEffect(() => {
    if (!attachMenuOpen) return;
    const closeOnOutside = (e: PointerEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setAttachMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [attachMenuOpen]);

  useEffect(() => {
    if (!activeMessageId) return;
    const closeOnOutside = (e: PointerEvent) => {
      const box = chatBoxRef.current;
      if (box && box.contains(e.target as Node)) return;
      setActiveMessageId(null);
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setActiveMessageId(null);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [activeMessageId, chatBoxRef]);

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
      onPointerDown={() => onInputFocus?.()}
      onFocus={onInputFocus}
      onKeyDown={handleKeyDown}
      className={`chat-input min-w-0 flex-1 ${isSendingText ? 'opacity-[0.85]' : 'opacity-100'}`}
      placeholder={t.chat_placeholder}
    />
  );

  return (
    <section
      className={`content-section chat-widget-section${isKidsTheme ? ' chat-widget-section--kids' : ''}${roomMode ? ' chat-widget-section--room' : ''}`}
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
        {unreadCount >= 5 && (
          <div className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 border border-indigo-200"
            style={{ fontSize: '3.2cqmin' }}>
            <span className="font-semibold">{t.chat_unread_badge.replace('{count}', String(unreadCount))}</span>
            <button
              type="button"
              onClick={() => setShowSummary((v) => !v)}
              className="rounded-full bg-indigo-500 px-2 py-0.5 text-white font-semibold hover:bg-indigo-600 transition-colors"
              style={{ fontSize: '3cqmin' }}
            >
              {showSummary ? t.chat_unread_dismiss : t.chat_unread_summary_btn}
            </button>
          </div>
        )}
      </div>
      {showSummary && unreadSummary.length > 0 && (
        <div className="relative z-[3] mx-2 mb-1 rounded-xl border border-indigo-100 bg-indigo-50/90 px-3 py-2"
          style={{ fontSize: '3.5cqmin' }}>
          <p className="mb-1 font-bold text-indigo-700" style={{ fontSize: '3.8cqmin' }}>
            {t.chat_unread_summary_title.replace('{count}', String(unreadCount))}
          </p>
          {unreadSummary.map((s) => (
            <div key={s.id} className="flex items-baseline gap-1 text-indigo-800">
              <span className="font-semibold">{s.name}</span>
              <span className="text-indigo-500">{s.count}</span>
              <span className="truncate text-indigo-600 opacity-80">— {s.first}</span>
            </div>
          ))}
          <button
            type="button"
            onClick={markLatestSeen}
            className="mt-1.5 text-indigo-400 hover:text-indigo-600 transition-colors text-xs"
          >
            {t.chat_unread_mark_all}
          </button>
        </div>
      )}
      <div className="section-body chat-section-body relative z-[3]">
        <div
          ref={chatBoxRef}
          className="chat-messages"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveMessageId(null);
          }}
        >
          {chatHasMoreOlder && (
            <div className="text-center" style={{ padding: '2cqmin 0 1cqmin' }}>
              <button
                type="button"
                onClick={onLoadOlderMessages}
                disabled={chatLoadingOlder}
                className="chat-load-older cursor-pointer rounded-full border border-indigo-200 bg-indigo-50 font-semibold text-indigo-600 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:cursor-wait disabled:opacity-75"
              >
                {chatLoadingOlder ? t.chat_loading_older : t.chat_load_older}
              </button>
            </div>
          )}
          {(messages || []).map((m) => {
            const messageId = String(m.id);
            const canQuickAdd = Boolean(
              m.text &&
                !isChatCipherText(m.text) &&
                (onOpenTaskWithText || onOpenCalendarWithText),
            );
            const actionsOpen = activeMessageId === messageId;
            return (
            <div
              key={messageId}
              className="message-item group/msg relative"
              onClick={() => {
                if (!canQuickAdd) return;
                setActiveMessageId((prev) => (prev === messageId ? null : messageId));
              }}
            >
              <div className="message-header">
                <span className="message-user flex items-center gap-1">
                  {m.sender_id && familyRoleByUserId[m.sender_id] && (
                    <>
                      <span className="chat-role-emoji">
                        {getFamilyRoleEmoji(familyRoleByUserId[m.sender_id])}
                      </span>
                      <span className="chat-role-label font-semibold text-slate-500">
                        {getFamilyRoleLabel(lang, familyRoleByUserId[m.sender_id])}
                      </span>
                    </>
                  )}
                  <span className={isKidsTheme && m.sender_id === userId ? 'chat-kids-me' : undefined}>
                    {!m.sender_id
                      ? getCommonTranslation(isValidLang(lang) ? lang : 'en', 'former_member')
                      : m.sender_id === userId
                      ? m.user === '나'
                        ? m.user
                        : t.me
                      : eventAuthorNames[m.sender_id] ?? (m.user === '사용자' ? t.user : m.user)}
                  </span>
                </span>
                <span className="message-time">{m.time}</span>
                {/* PC: hover, 모바일: 메시지 탭으로 토글 */}
                {canQuickAdd && (
                  <span
                    className={`ml-auto flex items-center gap-1 transition-opacity ${
                      actionsOpen ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100'
                    }`}
                  >
                    {onOpenTaskWithText && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isChatCipherText(m.text)) return;
                          onOpenTaskWithText(m.text);
                        }}
                        className="rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title={t.chat_quick_add_task}
                      >
                        ✅ {t.chat_quick_add_task}
                      </button>
                    )}
                    {onOpenCalendarWithText && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenCalendarWithText(m.text);
                        }}
                        className="rounded-full border border-violet-200 bg-white px-2 py-0.5 text-xs font-semibold text-violet-600 hover:bg-violet-50 transition-colors"
                        title={t.chat_quick_add_calendar}
                      >
                        📅 {t.chat_quick_add_calendar}
                      </button>
                    )}
                  </span>
                )}
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
                          <a
                            href={att.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
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
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!currentGroupId) return;
                                void onDeleteAttachment(att.id);
                              }}
                              className="chat-attachment-delete-btn absolute right-1 top-1 cursor-pointer rounded-full border-none bg-red-500/95 p-0 font-bold leading-none text-white transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
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
            );
          })}
        </div>
        <div className="chat-input-wrapper">
          {isKidsTheme ? (
            <div className="chat-kids-composer">
              <span className="chat-kids-mic" aria-hidden>
                <Mic className="chat-kids-mic-icon" />
              </span>
              {inputField}
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
});
