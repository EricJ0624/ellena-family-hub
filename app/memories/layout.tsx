import type { Viewport } from 'next';

/**
 * 브라우저 핀치로 페이지 자체를 확대하지 않는다.
 * 폰 장수 변경은 앨범 모음이 두 손가락 제스처로 직접 처리한다.
 * 페이지 확대가 겹치면 1·2장일 때 좌우가 잘린다.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function MemoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
