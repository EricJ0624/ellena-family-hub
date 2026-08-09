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
  _viewportWidth: number,
  hasAdminButton = false,
): number {
  // 세로도 좌측 정렬 — 가용 폭은 행 − 우측 admin 만 (좌우 이중 차감/액자 cap 제거로 글자 키움)
  if (!hasAdminButton || adminWidth <= 0) {
    return Math.max(120, rowWidth - 16);
  }
  const sideReserve = Math.max(adminWidth, DASHBOARD_TITLE_ADMIN_RESERVE_PX);
  return Math.max(120, rowWidth - sideReserve - 12);
}

/** @deprecated — getDashboardPortraitTitleFitMaxWidth 사용 */
export function getDashboardPortraitTitleFitWidth(viewportWidth: number, paddingPx = 8): number {
  return Math.max(120, getDashboardPortraitFrameMaxWidthPx(viewportWidth) - paddingPx);
}
