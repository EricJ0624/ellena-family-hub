'use client';

import { useState, useRef, useEffect } from 'react';
import { Megaphone, X } from 'lucide-react';

/** 공지 배너가 한 사이클에 이동하는 속도 (px/s). 이 값으로 공지 개수/길이와 관계없이 동일한 체감 속도 유지 */
const MARQUEE_PIXELS_PER_SECOND = 50;
/** 최소 duration(초). 너무 낮으면 1개 공지일 때도 50px/s 유지 가능. 높이면 1개일 때 느려짐 */
const MARQUEE_DURATION_MIN = 3;
const MARQUEE_DURATION_MAX = 120;

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
  const [isPaused, setIsPaused] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [animationDuration, setAnimationDuration] = useState(MARQUEE_DURATION_MIN);
  const trackRef = useRef<HTMLDivElement>(null);

  // 읽은 공지는 배너에 표시하지 않음. 미읽음만 표시.
  const unreadAnnouncements = announcements.filter(a => !a.is_read);
  const displayAnnouncements = [...unreadAnnouncements, ...unreadAnnouncements];

  // 내용 너비에 비례해 duration 계산 → 항상 같은 px/s 속도 유지
  useEffect(() => {
    if (displayAnnouncements.length === 0) return;
    const el = trackRef.current;
    if (!el) return;

    const measure = () => {
      // 레이아웃 완료 후 scrollWidth 측정 (공지 개수/내용에 따라 달라짐)
      const width = el.scrollWidth;
      if (width <= 0) return;
      // 키프레임이 -50% 이동하므로 한 사이클 이동 거리 = width * 0.5
      const distancePerCycle = width * 0.5;
      const duration = Math.max(
        MARQUEE_DURATION_MIN,
        Math.min(MARQUEE_DURATION_MAX, distancePerCycle / MARQUEE_PIXELS_PER_SECOND)
      );
      setAnimationDuration(duration);
    };

    // 첫 측정: 레이아웃 후 한 프레임 뒤에 측정 (공지 1개 vs 2개 모두 정확한 width 반영)
    const raf = requestAnimationFrame(() => {
      measure();
    });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [displayAnnouncements.length, unreadAnnouncements.map(a => a.id).join(',')]);

  const handleAnnouncementClick = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    if (onMarkAsRead && !announcement.is_read) {
      onMarkAsRead(announcement.id);
    }
  };

  // 미읽음이 없으면 배너 숨김 (읽은 공지는 배너에 안 나오는 것이 정상)
  if (!isVisible || unreadAnnouncements.length === 0) {
    return null;
  }

  return (
    <>
      {/* 배너 */}
      <div className="sticky top-0 z-[100] border-b border-primary/20 bg-primary/10 py-3 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between max-w-[1400px] mx-auto px-3 pr-6">
          {/* 아이콘 + 라벨 (최소 폭 없이 필요한 만큼만 사용) */}
          <div className="flex items-center gap-1 shrink-0">
            <Megaphone className="w-5 h-5 text-primary shrink-0" aria-hidden />
            <span className="text-sm font-semibold text-foreground">
              {label}
            </span>
          </div>

          {/* 스크롤 영역 (minWidth: 0으로 flex 오버플로우 시 줄어들 수 있게) */}
          <div className="flex-1 min-w-0 overflow-hidden relative mx-0.5">
            <div
              ref={trackRef}
              className="flex gap-12 w-max"
              style={{
                animation: isPaused ? 'none' : `marquee ${animationDuration}s linear infinite`,
                willChange: 'transform',
              }}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {displayAnnouncements.map((announcement, index) => (
                <div
                  key={`${announcement.id}-${index}`}
                  onClick={() => handleAnnouncementClick(announcement)}
                  className="flex items-center gap-2 cursor-pointer whitespace-nowrap text-sm text-foreground transition-colors hover:text-primary"
                >
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-primary text-primary-foreground">
                    NEW
                  </span>
                  <span className="font-semibold">
                    {announcement.title}
                  </span>
                  <span className="text-muted-foreground">
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
            type="button"
            onClick={() => setIsVisible(false)}
            className="p-1 rounded border-0 bg-transparent cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      {/* 상세 보기 모달 */}
      {selectedAnnouncement && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-foreground/40"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div
            className="bg-card text-card-foreground rounded-xl p-6 w-[90%] max-w-[600px] max-h-[80vh] overflow-auto shadow-xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-foreground m-0">
                {selectedAnnouncement.title}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                className="p-1 border-0 bg-transparent cursor-pointer text-muted-foreground hover:text-foreground rounded flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-muted-foreground mb-4">
              {new Date(selectedAnnouncement.created_at).toLocaleString('ko-KR')}
            </div>
            <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {selectedAnnouncement.content}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer bg-primary text-primary-foreground hover:opacity-90 border-0"
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
