/**
 * 가족 채팅(Family Chat) 섹션 컴포넌트
 */

'use client';

import React, { useRef } from 'react';

/** 헤더에서 제목 오른쪽에 붙는 장식 이모지 (디자인 변경 시 이 값만 조정) */
export const FAMILY_CHAT_HEADER_DECOR_EMOJI = '💬' as const;
import type { UploadedAttachment } from '@/lib/feature-attachments-client';
import type { ChatUiMessage } from '../types';

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
    section_chat_decor_aria: string;
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
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'clamp(6px, 1.5vw, 10px)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: 'relative',
              background: 'linear-gradient(180deg, #fde68a 0%, #facc15 100%)',
              border: '2px solid #0f172a',
              borderRadius: '14px',
              padding: '5px 12px 6px',
              fontSize: 'clamp(10px, 2.4vw, 13px)',
              fontWeight: 800,
              letterSpacing: '0.04em',
              color: '#ea580c',
              lineHeight: 1.15,
              boxShadow: '3px 3px 0 rgba(15, 23, 42, 0.12)',
              maxWidth: 'min(42vw, 200px)',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {t.section_chat_bubble_greeting}
          </div>
          <span
            role="img"
            aria-label={t.section_chat_decor_aria}
            style={{
              fontSize: 'clamp(1.2rem, 3.5vw, 1.65rem)',
              lineHeight: 1,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {FAMILY_CHAT_HEADER_DECOR_EMOJI}
          </span>
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
