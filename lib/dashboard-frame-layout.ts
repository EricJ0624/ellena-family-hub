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

/** 세로 액자일 때 타이틀 fit 기준 가용 폭 */
export function getDashboardPortraitTitleFitWidth(viewportWidth: number, paddingPx = 8): number {
  return Math.max(120, getDashboardPortraitFrameMaxWidthPx(viewportWidth) - paddingPx);
}
