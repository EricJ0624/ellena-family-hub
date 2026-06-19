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
  hasAdminButton = false,
): number {
  const frameCap = getDashboardPortraitFrameMaxWidthPx(viewportWidth);
  if (!hasAdminButton || adminWidth <= 0) {
    return Math.max(120, Math.min(frameCap, rowWidth - 16));
  }
  // flex [1fr | title | 1fr+Admin] — Admin은 오른쪽 열만 점유, 타이틀은 행 폭 − Admin − gap
  const layoutCap = rowWidth - adminWidth - 12;
  return Math.max(120, Math.min(frameCap, layoutCap));
}

/** @deprecated — getDashboardPortraitTitleFitMaxWidth 사용 */
export function getDashboardPortraitTitleFitWidth(viewportWidth: number, paddingPx = 8): number {
  return Math.max(120, getDashboardPortraitFrameMaxWidthPx(viewportWidth) - paddingPx);
}
