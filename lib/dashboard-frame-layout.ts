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
  _adminWidth: number,
  viewportWidth: number,
  _hasAdminButton = false,
): number {
  const frameCap = getDashboardPortraitFrameMaxWidthPx(viewportWidth);
  // 타이틀 박스·폰트는 액자 폭에 맞춤. Admin은 absolute overlay라 fit에서 차감하지 않음
  // (좌우 이중 차감 시 ~190px로 줄어 커스텀 이름이 과도하게 작아짐).
  return Math.max(120, Math.min(frameCap, rowWidth - 16));
}

/** @deprecated — getDashboardPortraitTitleFitMaxWidth 사용 */
export function getDashboardPortraitTitleFitWidth(viewportWidth: number, paddingPx = 8): number {
  return Math.max(120, getDashboardPortraitFrameMaxWidthPx(viewportWidth) - paddingPx);
}
