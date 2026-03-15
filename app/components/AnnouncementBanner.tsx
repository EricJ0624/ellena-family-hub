'use client';

import { useState, useEffect } from 'react';
import { Megaphone, X } from 'lucide-react';

/** 공지 항목 전환 간격 (ms). 한 줄 정적 표시 + 말줄임으로 단어 중간 잘림 원천 방지 */
const ANNOUNCEMENT_CYCLE_MS = 6000;

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  is_read?: boolean;
}

interface AnnouncementBannerProps {
  announcements: Announcement[];
  onMarkAsRead?: (announcementId: string) => void;
  /** 배너 좌측 라벨 (다국어 지원용, 미전달 시 "공지사항") */
  label?: string;
}

export default function AnnouncementBanner({ announcements, onMarkAsRead, label = '공지사항' }: AnnouncementBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [cycleIndex, setCycleIndex] = useState(0);

  // 읽지 않은 공지만 필터링
  const unreadAnnouncements = announcements.filter(a => !a.is_read);

  // 여러 공지일 때 N초마다 다음 항목으로 순환 (한 줄 정적 표시로 단어 중간 잘림 방지)
  useEffect(() => {
    if (unreadAnnouncements.length <= 1) return;
    const id = setInterval(() => {
      setCycleIndex((i) => (i + 1) % unreadAnnouncements.length);
    }, ANNOUNCEMENT_CYCLE_MS);
    return () => clearInterval(id);
  }, [unreadAnnouncements.length]);

  const handleAnnouncementClick = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    if (onMarkAsRead && !announcement.is_read) {
      onMarkAsRead(announcement.id);
    }
  };

  if (!isVisible || unreadAnnouncements.length === 0) {
    return null;
  }

  return (
    <>
      {/* 배너 */}
      <div style={{
        backgroundColor: '#fffbeb',
        borderBottom: '2px solid #fde68a',
        padding: '12px 0',
        overflow: 'hidden',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '1400px',
          margin: '0 auto',
          paddingLeft: '12px',
          paddingRight: '24px',
        }}>
          {/* 아이콘 + 라벨 (최소 폭 없이 필요한 만큼만 사용) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0,
          }}>
            <Megaphone style={{ 
              width: '20px', 
              height: '20px', 
              color: '#f59e0b',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#92400e',
            }}>
              {label}
            </span>
          </div>

          {/* 한 줄 정적 표시 + 말줄임: 항상 문장 앞부분이 보이도록 해 단어 중간 잘림(예: Welcome→lcome) 원천 방지 */}
          <div style={{
            flex: 1,
            minWidth: 0,
            minHeight: 24,
            overflow: 'hidden',
            position: 'relative',
            marginLeft: '8px',
            marginRight: '8px',
            display: 'flex',
            alignItems: 'center',
          }}>
            {unreadAnnouncements.length > 0 && (() => {
              const announcement = unreadAnnouncements[cycleIndex % unreadAnnouncements.length];
              const contentSnippet = announcement.content.length > 80
                ? `${announcement.content.substring(0, 80)}...`
                : announcement.content;
              const line = `${announcement.title} — ${contentSnippet}`;
              return (
                <button
                  type="button"
                  onClick={() => handleAnnouncementClick(announcement)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#78350f',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    minWidth: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#92400e';
                    e.currentTarget.style.fontWeight = '600';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#78350f';
                    e.currentTarget.style.fontWeight = '400';
                  }}
                >
                  <span style={{
                    padding: '2px 6px',
                    backgroundColor: '#fbbf24',
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    flexShrink: 0,
                  }}>
                    NEW
                  </span>
                  <span style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {line}
                  </span>
                </button>
              );
            })()}
          </div>

          {/* 닫기 버튼 */}
          <button
            onClick={() => setIsVisible(false)}
            style={{
              padding: '4px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#fde68a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
      </div>

      {/* 상세 보기 모달 */}
      {selectedAnnouncement && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#1e293b',
                margin: 0,
              }}>
                {selectedAnnouncement.title}
              </h3>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                style={{
                  padding: '4px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>
            <div style={{
              fontSize: '12px',
              color: '#94a3b8',
              marginBottom: '16px',
            }}>
              {new Date(selectedAnnouncement.created_at).toLocaleString('ko-KR')}
            </div>
            <div style={{
              fontSize: '14px',
              color: '#475569',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
            }}>
              {selectedAnnouncement.content}
            </div>
            <div style={{
              marginTop: '24px',
              display: 'flex',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#9333ea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
