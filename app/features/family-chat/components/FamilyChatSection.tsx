/**
 * 가족 채팅(Family Chat) 섹션 컴포넌트
 */

'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import type { UploadedAttachment } from '@/lib/feature-attachments-client';
import type { ChatUiMessage } from '../types';

/** `public/images` 기준 말풍선 일러스트 (교체 시 파일명만 맞추면 됨) */
export const FAMILY_CHAT_BUBBLE_IMAGE_SRC = '/images/family-chat-hello-bubble.png' as const;

/** 헤더 말풍선 박스 크기 — 한곳에서 조절 */
export const FAMILY_CHAT_BUBBLE_LAYOUT = {
  width: 'clamp(104px, 28vw, 176px)',
  height: 'clamp(80px, 21vw, 132px)',
} as const;

interface FamilyChatSectionProps {
  messages: ChatUiMessage[];
  userId: string;
  currentGroupId: string | null;
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

export function FamilyChatSection({
  messages,
  userId,
  currentGroupId,
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
  const handleSendClick = () => {
    const input = chatInputRef.current;
    if (!input || !input.value.trim()) return;
    
    onSendMessage(input.value.trim());
    input.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;
    e.preventDefault();
    handleSendClick();
  };

  return (
    <section className="content-section">
      <div className="section-header">
        <h3 className="section-title" style={{ margin: 0 }}>
          {t.section_title_chat}
        </h3>
        <div
          style={{
            position: 'relative',
            flexShrink: 0,
            width: FAMILY_CHAT_BUBBLE_LAYOUT.width,
            height: FAMILY_CHAT_BUBBLE_LAYOUT.height,
          }}
        >
          <Image
            src={FAMILY_CHAT_BUBBLE_IMAGE_SRC}
            alt=""
            fill
            sizes="(max-width: 768px) 28vw, 176px"
            style={{ objectFit: 'contain', objectPosition: 'center' }}
            priority={false}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '44%',
              transform: 'translate(-50%, -50%)',
              width: '58%',
              maxWidth: '100%',
              textAlign: 'center',
              fontSize: 'clamp(8px, 2.1vw, 12px)',
              fontWeight: 900,
              letterSpacing: '0.05em',
              lineHeight: 1.05,
              color: '#ea580c',
              textShadow:
                '1.5px 0 0 #0f172a, -1.5px 0 0 #0f172a, 0 1.5px 0 #0f172a, 0 -1.5px 0 #0f172a, 2px 2px 0 rgba(15,23,42,0.2)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              pointerEvents: 'none',
            }}
          >
            {t.section_chat_bubble_greeting}
          </div>
        </div>
      </div>
      <div className="section-body">
        <div ref={chatBoxRef} className="chat-messages">
          {chatHasMoreOlder && (
            <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
              <button
                type="button"
                onClick={onLoadOlderMessages}
                disabled={chatLoadingOlder}
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#4f46e5',
                  background: '#eef2ff',
                  border: '1px solid #c7d2fe',
                  borderRadius: '999px',
                  cursor: chatLoadingOlder ? 'wait' : 'pointer',
                  opacity: chatLoadingOlder ? 0.75 : 1,
                }}
              >
                {chatLoadingOlder ? t.chat_loading_older : t.chat_load_older}
              </button>
            </div>
          )}
          {(messages || []).map((m) => (
            <div key={String(m.id)} className="message-item">
              <div className="message-header">
                <span className="message-user" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {m.sender_id && familyRoleByUserId[m.sender_id] && (
                    <>
                      <span style={{ fontSize: '20px', lineHeight: '1' }}>
                        {getFamilyRoleEmoji(familyRoleByUserId[m.sender_id])}
                      </span>
                      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
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
                    <div style={{ marginBottom: '8px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }}>
                      {showLocalPreviews &&
                        previews.map((src, pi) => (
                          <div
                            key={`pv-${pi}`}
                            className="chat-attachment-cell"
                            style={{ position: 'relative' }}
                            title="업로드 중"
                          >
                            <img
                              src={src}
                              alt=""
                              style={{
                                width: '100%',
                                height: '84px',
                                objectFit: 'cover',
                                borderRadius: '8px',
                                opacity: 0.92,
                              }}
                            />
                            <span
                              style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#fff',
                                background: 'rgba(15,23,42,0.35)',
                                borderRadius: '8px',
                                pointerEvents: 'none',
                              }}
                            >
                              …
                            </span>
                          </div>
                        ))}
                      {rows.map((att) => (
                        <div key={att.id} className="chat-attachment-cell" style={{ position: 'relative' }}>
                          <a href={att.image_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={att.thumbnail_url || att.image_url}
                              alt={att.original_filename}
                              style={{ width: '100%', height: '84px', objectFit: 'cover', borderRadius: '8px' }}
                            />
                          </a>
                          {m.sender_id === userId && (
                            <button
                              type="button"
                              className="chat-attachment-delete-btn"
                              onClick={() => {
                                if (!currentGroupId) return;
                                void onDeleteAttachment(att.id);
                              }}
                              style={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                width: 18,
                                height: 18,
                                borderRadius: '999px',
                                border: 'none',
                                background: 'rgba(239,68,68,0.95)',
                                color: '#fff',
                                fontSize: 11,
                                cursor: 'pointer',
                                lineHeight: '18px',
                                padding: 0,
                              }}
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
        <div className="chat-input-wrapper" style={{ gap: '6px' }}>
          <input
            ref={chatInputRef}
            type="text"
            onKeyDown={handleKeyDown}
            className="chat-input"
            placeholder={t.chat_placeholder}
            style={{ flex: 1, minWidth: 0, padding: '11px 12px' }}
          />
          <button type="button" onClick={handleSendClick} className="btn-send" style={{ padding: '8px 12px', fontSize: '12px' }}>
            {t.chat_send}
          </button>
          <button
            type="button"
            onClick={() => chatFileInputRef.current?.click()}
            style={{
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              padding: '7px 9px',
              background: '#f8fafc',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {t.chat_album_btn}
          </button>
          <button
            type="button"
            onClick={() => chatCameraInputRef.current?.click()}
            style={{
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              padding: '7px 9px',
              background: '#f8fafc',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {t.chat_camera_btn}
          </button>
          <input
            ref={chatFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            onChange={onPickFiles}
            style={{ display: 'none' }}
          />
          <input
            ref={chatCameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            capture="environment"
            onChange={onPickFiles}
            style={{ display: 'none' }}
          />
        </div>
      </div>
    </section>
  );
}
