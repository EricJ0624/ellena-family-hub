'use client';

import type { UploadedAttachment } from '@/lib/feature-attachments-client';
import type { DiaryCollageStyle, PhotoFocusMap } from '@/lib/modules/travel-planner/diary-collage';
import { COLLAGE_SLOT_COUNT, objectPositionCss } from '@/lib/modules/travel-planner/diary-collage';

const FILM_SLOTS: Record<1 | 2 | 3 | 4 | 5 | 6, string[]> = {
  1: ['left-[6%] top-[7%] z-[1] h-[86%] w-[88%] rotate-[-1deg]'],
  2: [
    'left-[4%] top-[10%] z-[1] h-[80%] w-[44%] rotate-[-3deg]',
    'left-[52%] top-[10%] z-[2] h-[80%] w-[44%] rotate-[3deg]',
  ],
  3: [
    'left-[3%] top-[8%] z-[1] h-[84%] w-[44%] rotate-[-3deg]',
    'left-[53%] top-[6%] z-[2] h-[42%] w-[44%] rotate-[3deg]',
    'left-[53%] top-[52%] z-[2] h-[42%] w-[44%] rotate-[-2deg]',
  ],
  4: [
    'left-[5%] top-[6%] z-[1] h-[43%] w-[43%] rotate-[-3deg]',
    'left-[52%] top-[5%] z-[2] h-[43%] w-[43%] rotate-[3deg]',
    'left-[6%] top-[52%] z-[1] h-[43%] w-[43%] rotate-[2deg]',
    'left-[51%] top-[51%] z-[2] h-[43%] w-[43%] rotate-[-2deg]',
  ],
  5: [
    'left-[4%] top-[5%] z-[1] h-[43%] w-[28%] rotate-[-3deg]',
    'left-[36%] top-[6%] z-[2] h-[43%] w-[28%] rotate-[2deg]',
    'left-[68%] top-[5%] z-[1] h-[43%] w-[28%] rotate-[3deg]',
    'left-[20%] top-[52%] z-[2] h-[43%] w-[28%] rotate-[2deg]',
    'left-[52%] top-[51%] z-[1] h-[43%] w-[28%] rotate-[-2deg]',
  ],
  6: [
    'left-[4%] top-[5%] z-[1] h-[43%] w-[28%] rotate-[-3deg]',
    'left-[36%] top-[6%] z-[2] h-[43%] w-[28%] rotate-[2deg]',
    'left-[68%] top-[5%] z-[1] h-[43%] w-[28%] rotate-[3deg]',
    'left-[4%] top-[52%] z-[2] h-[43%] w-[28%] rotate-[2deg]',
    'left-[36%] top-[51%] z-[1] h-[43%] w-[28%] rotate-[-2deg]',
    'left-[68%] top-[52%] z-[2] h-[43%] w-[28%] rotate-[1deg]',
  ],
};

const POSTAL_SLOTS: Record<1 | 2 | 3 | 4 | 5 | 6, string[]> = {
  1: ['left-[10%] top-[8%] z-[1] h-[84%] w-[80%] rotate-[-1deg]'],
  2: [
    'left-[4%] top-[10%] z-[1] h-[80%] w-[44%] rotate-[-3deg]',
    'left-[52%] top-[10%] z-[2] h-[80%] w-[44%] rotate-[3deg]',
  ],
  3: [
    'left-[3%] top-[8%] z-[1] h-[84%] w-[44%] rotate-[-3deg]',
    'left-[53%] top-[6%] z-[2] h-[42%] w-[44%] rotate-[3deg]',
    'left-[53%] top-[52%] z-[2] h-[42%] w-[44%] rotate-[-2deg]',
  ],
  4: [
    'left-[5%] top-[6%] z-[1] h-[43%] w-[43%] rotate-[-3deg]',
    'left-[52%] top-[5%] z-[2] h-[43%] w-[43%] rotate-[3deg]',
    'left-[6%] top-[52%] z-[1] h-[43%] w-[43%] rotate-[2deg]',
    'left-[51%] top-[51%] z-[2] h-[43%] w-[43%] rotate-[-2deg]',
  ],
  5: [
    'left-[4%] top-[5%] z-[1] h-[43%] w-[28%] rotate-[-3deg]',
    'left-[36%] top-[6%] z-[2] h-[43%] w-[28%] rotate-[2deg]',
    'left-[68%] top-[5%] z-[1] h-[43%] w-[28%] rotate-[3deg]',
    'left-[20%] top-[52%] z-[2] h-[43%] w-[28%] rotate-[2deg]',
    'left-[52%] top-[51%] z-[1] h-[43%] w-[28%] rotate-[-2deg]',
  ],
  6: [
    'left-[4%] top-[5%] z-[1] h-[43%] w-[28%] rotate-[-3deg]',
    'left-[36%] top-[6%] z-[2] h-[43%] w-[28%] rotate-[2deg]',
    'left-[68%] top-[5%] z-[1] h-[43%] w-[28%] rotate-[3deg]',
    'left-[4%] top-[52%] z-[2] h-[43%] w-[28%] rotate-[2deg]',
    'left-[36%] top-[51%] z-[1] h-[43%] w-[28%] rotate-[-2deg]',
    'left-[68%] top-[52%] z-[2] h-[43%] w-[28%] rotate-[1deg]',
  ],
};

function panoramaClass(count: number): string {
  if (count <= 1) return 'aspect-[16/9]';
  if (count <= 3) return 'aspect-[2/1]';
  return 'aspect-[5/3]';
}

function photoSrc(attachment: UploadedAttachment): string {
  return attachment.thumbnail_url || attachment.image_url || '';
}

export function DiaryPhotoCollage({
  photos,
  style,
  photosLabel,
  onOpen,
  photoFocus,
}: {
  photos: UploadedAttachment[];
  style: DiaryCollageStyle;
  photosLabel: string;
  onOpen: () => void;
  photoFocus?: PhotoFocusMap;
}) {
  const count = Math.min(Math.max(photos.length, 0), COLLAGE_SLOT_COUNT) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  if (count === 0) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="relative mt-3 block aspect-[16/9] w-full cursor-pointer overflow-hidden rounded-xl border border-dashed border-violet-300 bg-gradient-to-br from-amber-50 to-stone-100 p-0 text-xs font-medium text-violet-700"
        aria-label={photosLabel}
      >
        {photosLabel}
      </button>
    );
  }

  const slots = (style === 'postal' ? POSTAL_SLOTS : FILM_SLOTS)[count];
  const isPostal = style === 'postal';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        'relative mt-3 block w-full cursor-pointer overflow-hidden rounded-xl border-0 p-0 text-left',
        isPostal
          ? 'bg-gradient-to-br from-amber-50 via-orange-50 to-stone-100'
          : 'bg-gradient-to-br from-amber-50 to-stone-100',
        panoramaClass(count),
      ].join(' ')}
      aria-label={photosLabel}
    >
      {isPostal ? (
        <div className="pointer-events-none absolute inset-2 rounded-lg border border-dashed border-amber-200/80" />
      ) : null}
      {photos.slice(0, count).map((attachment, index) => (
        <div
          key={attachment.id}
          className={['absolute origin-center', slots[index] ?? ''].join(' ')}
        >
          {isPostal ? (
            <div className="h-full w-full bg-white p-[4px] pb-5 shadow-[0_8px_18px_rgba(120,53,15,0.18)]">
              <img
                src={photoSrc(attachment)}
                alt=""
                className="h-full w-full object-cover"
                style={{ objectPosition: objectPositionCss(photoFocus?.[attachment.id]) }}
              />
            </div>
          ) : (
            <div className="h-full w-full overflow-hidden rounded-[2px] bg-zinc-950 p-[3px] shadow-[0_10px_22px_rgba(15,23,42,0.28)]">
              <img
                src={photoSrc(attachment)}
                alt=""
                className="h-full w-full object-cover"
                style={{ objectPosition: objectPositionCss(photoFocus?.[attachment.id]) }}
              />
            </div>
          )}
        </div>
      ))}
    </button>
  );
}
