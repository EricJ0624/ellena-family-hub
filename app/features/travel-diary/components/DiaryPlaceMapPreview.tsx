'use client';

import React from 'react';
import { MapPin } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getTravelTranslation } from '@/lib/translations/travel';
import {
  buildGoogleMapsViewUrl,
  buildMapsEmbedUrl,
  canShowDiaryPlaceMap,
  type GoogleMapsPlaceRef,
} from '@/lib/modules/travel-planner/google-maps-embed';

type Props = {
  place: GoogleMapsPlaceRef;
  sourceKind?: string | null;
};

export function DiaryPlaceMapPreview({ place, sourceKind }: Props) {
  const { lang } = useLanguage();
  const viewOnMap = getTravelTranslation(lang, 'view_on_map');
  const address = typeof place.address === 'string' ? place.address.trim() : '';

  if (!canShowDiaryPlaceMap(place, sourceKind)) return null;

  const viewUrl = buildGoogleMapsViewUrl(place);
  const embedUrl = buildMapsEmbedUrl(place, { language: lang, zoom: 13 });
  const iframeTitle = (typeof place.title === 'string' && place.title.trim()) || viewOnMap;

  return (
    <div className="flex min-h-24 min-w-0 flex-1 flex-col">
      {embedUrl ? (
        <div className="relative min-h-24 flex-1 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
          <iframe
            title={iframeTitle}
            src={embedUrl}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      ) : viewUrl ? (
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex cursor-pointer items-center gap-0.5 text-[11px] font-medium leading-tight text-blue-600 no-underline hover:text-blue-700 hover:underline"
        >
          <MapPin className="h-3 w-3 shrink-0" />
          {viewOnMap}
        </a>
      ) : null}

      {address ? (
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">{address}</p>
      ) : null}
    </div>
  );
}
