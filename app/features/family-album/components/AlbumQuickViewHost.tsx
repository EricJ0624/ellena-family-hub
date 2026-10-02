'use client';

import { useEffect, useState } from 'react';
import {
  getAlbumQuickViewSrc,
  hideAlbumQuickView,
  subscribeAlbumQuickView,
} from '../album-quick-view-store';

/**
 * 루트 레이아웃에 둔다. 위젯 클릭 직후, 앨범 화면이 뜨기 전에 같은 사진을 보여 준다.
 */
export function AlbumQuickViewHost() {
  const [src, setSrc] = useState(getAlbumQuickViewSrc);

  useEffect(() => subscribeAlbumQuickView(() => setSrc(getAlbumQuickViewSrc())), []);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/95"
      onClick={hideAlbumQuickView}
      role="presentation"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="max-h-full max-w-full object-contain" />
    </div>
  );
}
