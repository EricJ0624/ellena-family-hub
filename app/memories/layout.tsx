import type { Viewport } from 'next';

/** 사진첩에서만 줌 허용 (5↔3↔1 열 전환 동작을 위해) */
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
