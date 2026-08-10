'use client';

/**
 * 일정표 미리보기 — PDF와 동일한 HTML 단일 소스(`buildItineraryDocumentHtml`)를 iframe으로 표시합니다.
 * 디자인 수정은 `lib/modules/travel-planner/itinerary-document-html.ts` 한곳만 하면 됩니다.
 */
import { useCallback, useMemo, useRef } from 'react';
import type { TravelAccommodation, TravelTrip } from '@/lib/modules/travel-planner/types';
import { buildItineraryDocumentHtml } from '@/lib/modules/travel-planner/itinerary-document-html';

export type ItineraryDocumentItem = {
  type: 'accommodation' | 'dining' | 'attraction' | 'transport' | 'other';
  day_date: string;
  start_time?: string | null;
  end_time?: string | null;
  title: string;
  description?: string | null;
  address?: string | null;
  transport_type?: 'air' | 'train' | 'car' | 'bike';
};

export type ItineraryDocumentLabels = {
  overviewKo: string;
  overviewEn: string;
  detailsKo: string;
  detailsEn: string;
};

type Props = {
  trip: TravelTrip;
  items: ItineraryDocumentItem[];
  accommodations: TravelAccommodation[];
  transports: Array<{
    transport_type: string;
    departure?: string | null;
    arrival?: string | null;
    day_date?: string;
    end_day_date?: string | null;
    memo?: string | null;
  }>;
  dayTitles: Record<string, string>;
  labels: ItineraryDocumentLabels;
  travelerNames?: string[];
  travelerNationalities?: string[];
  coverImageUrl?: string | null;
  mapImageUrl?: string | null;
};

export const ITINERARY_DOC_FRAME_ID = 'itinerary-document-frame';

/** 미리보기 iframe 내용 인쇄 (PDF와 동일 HTML) */
export function printItineraryDocumentPreview(): void {
  const frame = document.getElementById(ITINERARY_DOC_FRAME_ID) as HTMLIFrameElement | null;
  frame?.contentWindow?.focus();
  frame?.contentWindow?.print();
}

export function ItineraryDocument({
  trip,
  items,
  accommodations,
  transports,
  dayTitles,
  labels,
  travelerNames,
  travelerNationalities,
  coverImageUrl,
  mapImageUrl,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const html = useMemo(
    () =>
      buildItineraryDocumentHtml({
        trip,
        items: items.map((it) => ({
          type: it.type,
          day_date: it.day_date,
          start_time: it.start_time,
          end_time: it.end_time,
          title: it.title,
          description: it.description,
          address: it.address,
        })),
        accommodations,
        transports,
        dayTitles,
        labels,
        travelerNames,
        travelerNationalities,
        coverImageUrl,
        mapImageUrl,
      }),
    [
      trip,
      items,
      accommodations,
      transports,
      dayTitles,
      labels,
      travelerNames,
      travelerNationalities,
      coverImageUrl,
      mapImageUrl,
    ],
  );

  const onLoad = useCallback(() => {
    const frame = iframeRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc?.body) return;
    frame.style.height = `${Math.max(doc.body.scrollHeight + 24, 480)}px`;
  }, []);

  return (
    <iframe
      ref={iframeRef}
      id={ITINERARY_DOC_FRAME_ID}
      title="itinerary-document"
      srcDoc={html}
      onLoad={onLoad}
      className="itin-doc-preview-frame block w-full border-0 bg-[#F7F5F2]"
      sandbox="allow-same-origin allow-modals"
    />
  );
}
