'use client';

import type { ReactNode } from 'react';
import type { UploadedAttachment } from '@/lib/feature-attachments-client';
import type { DiaryCollageStyle, PhotoFocusMap } from '@/lib/modules/travel-planner/diary-collage';
import { COLLAGE_SLOT_COUNT, objectPositionCss } from '@/lib/modules/travel-planner/diary-collage';

const FILM_SLOTS: Record<1 | 2 | 3 | 6, string[]> = {
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
  6: [
    'left-[4%] top-[5%] z-[1] h-[43%] w-[28%] rotate-[-3deg]',
    'left-[36%] top-[6%] z-[2] h-[43%] w-[28%] rotate-[2deg]',
    'left-[68%] top-[5%] z-[1] h-[43%] w-[28%] rotate-[3deg]',
    'left-[4%] top-[52%] z-[2] h-[43%] w-[28%] rotate-[2deg]',
    'left-[36%] top-[51%] z-[1] h-[43%] w-[28%] rotate-[-2deg]',
    'left-[68%] top-[52%] z-[2] h-[43%] w-[28%] rotate-[1deg]',
  ],
};

const POSTAL_SLOTS: Record<1 | 2 | 3 | 6, string[]> = {
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
  6: [
    'left-[4%] top-[5%] z-[1] h-[43%] w-[28%] rotate-[-3deg]',
    'left-[36%] top-[6%] z-[2] h-[43%] w-[28%] rotate-[2deg]',
    'left-[68%] top-[5%] z-[1] h-[43%] w-[28%] rotate-[3deg]',
    'left-[4%] top-[52%] z-[2] h-[43%] w-[28%] rotate-[2deg]',
    'left-[36%] top-[51%] z-[1] h-[43%] w-[28%] rotate-[-2deg]',
    'left-[68%] top-[52%] z-[2] h-[43%] w-[28%] rotate-[1deg]',
  ],
};

/** Same scrapbook tilts as the 6-photo rows, continued across the third row. */
const GRID_TILTS = [
  'z-[1] rotate-[-3deg]',
  'z-[2] rotate-[2deg]',
  'z-[1] rotate-[3deg]',
  'z-[2] rotate-[2deg]',
  'z-[1] rotate-[-2deg]',
  'z-[2] rotate-[1deg]',
  'z-[1] rotate-[-2deg]',
  'z-[2] rotate-[3deg]',
  'z-[1] rotate-[-1deg]',
];

/** Short rows stay centered so 4, 5, 7, and 8 do not leave an empty hole on the right. */
const BALANCED_ROWS: Record<4 | 5 | 7 | 8, number[]> = {
  4: [2, 2],
  5: [3, 2],
  7: [3, 3, 1],
  8: [3, 3, 2],
};

function panoramaClass(count: number): string {
  if (count <= 1) return 'aspect-[16/9]';
  if (count <= 3) return 'aspect-[2/1]';
  return 'aspect-[5/3]';
}

function photoSrc(attachment: UploadedAttachment): string {
  return attachment.thumbnail_url || attachment.image_url || '';
}

function isScatteredCount(count: number): count is 1 | 2 | 3 | 6 {
  return count === 1 || count === 2 || count === 3 || count === 6;
}

function isBalancedCount(count: number): count is 4 | 5 | 7 | 8 {
  return count === 4 || count === 5 || count === 7 || count === 8;
}

function chunkRows(photos: UploadedAttachment[], rowSizes: number[]): UploadedAttachment[][] {
  const rows: UploadedAttachment[][] = [];
  let index = 0;
  for (const size of rowSizes) {
    rows.push(photos.slice(index, index + size));
    index += size;
  }
  return rows;
}

export function DiaryPhotoCollage({
  photos,
  style,
  photosLabel,
  onOpen,
  onSelectPhoto,
  photoFocus,
}: {
  photos: UploadedAttachment[];
  style: DiaryCollageStyle;
  photosLabel: string;
  onOpen: () => void;
  onSelectPhoto?: (attachment: UploadedAttachment) => void;
  photoFocus?: PhotoFocusMap;
}) {
  const count = Math.min(Math.max(photos.length, 0), COLLAGE_SLOT_COUNT);
  if (count === 0) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="relative mt-3 block aspect-[16/9] w-full cursor-pointer appearance-none border border-dashed border-[#cfc8bf]/80 bg-transparent p-0 text-xs font-medium text-[#57534e] shadow-none"
        style={{ backgroundColor: 'transparent' }}
        aria-label={photosLabel}
      >
        {photosLabel}
      </button>
    );
  }

  const isPostal = style === 'postal';
  const shown = photos.slice(0, count);

  const frameFor = (attachment: UploadedAttachment) =>
    isPostal ? (
      <div className="h-full w-full bg-white p-[4px] pb-5 shadow-[0_4px_10px_rgba(30,27,75,0.1)]">
        <img
          src={photoSrc(attachment)}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
          style={{ objectPosition: objectPositionCss(photoFocus?.[attachment.id]) }}
        />
      </div>
    ) : (
      <div className="h-full w-full overflow-hidden rounded-[2px] bg-zinc-950 p-[3px] shadow-[0_4px_10px_rgba(15,23,42,0.16)]">
        <img
          src={photoSrc(attachment)}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
          style={{ objectPosition: objectPositionCss(photoFocus?.[attachment.id]) }}
        />
      </div>
    );

  const interactive = (attachment: UploadedAttachment, frame: ReactNode) =>
    onSelectPhoto ? (
      <button
        type="button"
        draggable={false}
        onClick={() => onSelectPhoto(attachment)}
        className="h-full w-full cursor-zoom-in border-0 bg-transparent p-0"
        aria-label={photosLabel}
      >
        {frame}
      </button>
    ) : (
      frame
    );

  let body: ReactNode;
  let shellLayout: string;

  if (isScatteredCount(count)) {
    const slots = (isPostal ? POSTAL_SLOTS : FILM_SLOTS)[count];
    shellLayout = panoramaClass(count);
    body = shown.map((attachment, index) => (
      <div key={attachment.id} className={['absolute origin-center', slots[index] ?? ''].join(' ')}>
        {interactive(attachment, frameFor(attachment))}
      </div>
    ));
  } else if (isBalancedCount(count)) {
    const cellWidth = count === 4 ? 'w-[calc((100%-0.5rem)/2)]' : 'w-[calc((100%-1rem)/3)]';
    shellLayout = 'flex flex-col gap-2 py-2';
    let index = 0;
    body = chunkRows(shown, BALANCED_ROWS[count]).map((row) => {
      const rowKey = row.map((photo) => photo.id).join('-');
      return (
        <div key={rowKey} className="flex justify-center gap-2">
          {row.map((attachment) => {
            const tilt = GRID_TILTS[index] ?? '';
            index += 1;
            return (
              <div key={attachment.id} className={['relative aspect-[3/2] min-w-0 origin-center', cellWidth, tilt].join(' ')}>
                {interactive(attachment, frameFor(attachment))}
              </div>
            );
          })}
        </div>
      );
    });
  } else {
    shellLayout = 'grid grid-cols-3 gap-2 py-2';
    body = shown.map((attachment, index) => (
      <div
        key={attachment.id}
        className={['aspect-[3/2] min-w-0 origin-center', GRID_TILTS[index] ?? ''].join(' ')}
      >
        {interactive(attachment, frameFor(attachment))}
      </div>
    ));
  }

  const shellClass = [
    'relative mt-3 block w-full appearance-none border-0 bg-transparent p-0 text-left shadow-none',
    shellLayout,
    onSelectPhoto ? '' : 'cursor-pointer',
  ].join(' ');

  if (onSelectPhoto) {
    return (
      <div className={shellClass} style={{ backgroundColor: 'transparent', backgroundImage: 'none' }}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={shellClass}
      style={{ backgroundColor: 'transparent', backgroundImage: 'none' }}
      aria-label={photosLabel}
    >
      {body}
    </button>
  );
}
