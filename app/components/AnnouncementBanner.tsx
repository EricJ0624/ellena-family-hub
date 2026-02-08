'use client';

import { useState } from 'react';
import { Megaphone, X } from 'lucide-react';

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
}

export default function AnnouncementBanner({ announcements, onMarkAsRead }: AnnouncementBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // 읽지 않은 공지만 필터링
  const unreadAnnouncements = announcements.filter(a => !a.is_read);

  // 공지가 없거나 배너를 닫았으면 표시하지 않음
  if (!isVisible || unreadAnnouncements.length === 0) {
    return null;
  }

  // 무한 스크롤을 위해 공지사항 배열을 2번 반복
  const displayAnnouncements = [...unreadAnnouncements, ...unreadAnnouncements];

  const handleAnnouncementClick = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    if (onMarkAsRead && !announcement.is_read) {
      onMarkAsRead(announcement.id);
    }
  };

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
          paddingLeft: '24px',
          paddingRight: '24px',
        }}>
          {/* 아이콘 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: '120px',
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
              공지사항
            </span>
          </div>

          {/* 스크롤 영역 */}
          <div style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
            marginLeft: '16px',
            marginRight: '16px',
          }}>
            <div
              style={{
                display: 'flex',
                gap: '48px',
                animation: isPaused ? 'none' : 'marquee 40s linear infinite',
                willChange: 'transform',
              }}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {displayAnnouncements.map((announcement, index) => (
                <div
                  key={`${announcement.id}-${index}`}
                  onClick={() => handleAnnouncementClick(announcement)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontSize: '14px',
                    color: '#78350f',
                    transition: 'all 0.2s',
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
                    padding: '2px 8px',
                    backgroundColor: '#fbbf24',
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600',
                  }}>
                    NEW
                  </span>
                  <span style={{ fontWeight: '600' }}>
                    {announcement.title}
                  </span>
                  <span style={{ color: '#a16207' }}>
                    {announcement.content.length > 80 
                      ? `${announcement.content.substring(0, 80)}...` 
                      : announcement.content}
                  </span>
                </div>
              ))}
            </div>
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

      {/* CSS 애니메이션 */}
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </>
  );
}
