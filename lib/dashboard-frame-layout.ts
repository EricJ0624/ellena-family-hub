/** TitlePage DailyPhotoFrame 과 동일 — 대시보드 타이틀 행 정렬·fit 폭 */
export const DASHBOARD_PHOTO_FRAME_MAX_WIDTH_PX = {
  portrait: 320,
  portraitMd: 340,
  landscape: 380,
} as const;

export function getDashboardPortraitFrameMaxWidthPx(viewportWidth: number): number {
  return viewportWidth >= 768
    ? DASHBOARD_PHOTO_FRAME_MAX_WIDTH_PX.portraitMd
    : DASHBOARD_PHOTO_FRAME_MAX_WIDTH_PX.portrait;
}

/** Admin 버튼 예약 폭 (fit·레이아웃 공통) */
export const DASHBOARD_TITLE_ADMIN_RESERVE_PX = 92;

export function getDashboardPortraitTitleFitMaxWidth(
  rowWidth: number,
  adminWidth: number,
  viewportWidth: number,
): number {
  const frameCap = getDashboardPortraitFrameMaxWidthPx(viewportWidth);
  // 3열 grid — 타이틀은 가운데 열(액자 폭), Admin은 오른쪽 1fr
  const withoutAdmin = rowWidth - adminWidth - 12;
  return Math.max(120, Math.min(frameCap, withoutAdmin));
}

/** @deprecated — getDashboardPortraitTitleFitMaxWidth 사용 */
export function getDashboardPortraitTitleFitWidth(viewportWidth: number, paddingPx = 8): number {
  return Math.max(120, getDashboardPortraitFrameMaxWidthPx(viewportWidth) - paddingPx);
}
