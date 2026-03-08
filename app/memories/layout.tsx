import type { Viewport } from 'next';

/** 사진첩에서만 줌 허용 (그리드 열 수가 뷰포트/줌에 따라 변경되도록) */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function MemoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
