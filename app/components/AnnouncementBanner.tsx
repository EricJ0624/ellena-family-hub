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

  // 읽은 공지는 배너에 표시하지 않음. 미읽음만 표시. (is_read가 비정상 문자열이어도 true만 읽음으로 처리)
  const unreadAnnouncements = announcements.filter((a) => a.is_read !== true);
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
    if (onMarkAsRead && announcement.is_read !== true) {
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
      <div className="sticky top-0 z-[100] overflow-hidden border-b-2 border-amber-200 bg-amber-50 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-3 pr-6">
          {/* 아이콘 + 라벨 (최소 폭 없이 필요한 만큼만 사용) */}
          <div className="flex shrink-0 items-center gap-1">
            <Megaphone className="h-5 w-5 shrink-0 text-amber-500" />
            <span className="text-sm font-semibold text-amber-800">
              {label}
            </span>
          </div>

          {/* 스크롤 영역 (minWidth: 0으로 flex 오버플로우 시 줄어들 수 있게) */}
          <div className="relative mx-0.5 min-w-0 flex-1 overflow-hidden">
            <div
              ref={trackRef}
              style={{
                width: 'max-content',
                animation: isPaused ? 'none' : `marquee ${animationDuration}s linear infinite`,
                willChange: 'transform',
              }}
              className="flex gap-12"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {displayAnnouncements.map((announcement, index) => (
                <div
                  key={`${announcement.id}-${index}`}
                  onClick={() => handleAnnouncementClick(announcement)}
                  className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-amber-900 transition-all duration-200 hover:font-semibold hover:text-amber-800"
                >
                  <span className="rounded px-2 py-0.5 text-[11px] font-semibold text-white bg-amber-400">
                    NEW
                  </span>
                  <span className="font-semibold">
                    {announcement.title}
                  </span>
                  <span className="text-amber-700">
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
            className="flex items-center justify-center rounded p-1 text-amber-800 transition-all duration-200 hover:bg-amber-200"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* 상세 보기 모달 */}
      {selectedAnnouncement && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div
            className="max-h-[80vh] w-[90%] max-w-[600px] overflow-auto rounded-xl bg-white p-6 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0 text-xl font-semibold text-slate-800">
                {selectedAnnouncement.title}
              </h3>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="flex items-center justify-center rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 text-xs text-slate-400">
              {new Date(selectedAnnouncement.created_at).toLocaleString('ko-KR')}
            </div>
            <div className="whitespace-pre-wrap text-sm leading-[1.6] text-slate-600">
              {selectedAnnouncement.content}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="cursor-pointer rounded-lg border-none bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700"
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
