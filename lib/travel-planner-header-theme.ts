/**
 * 가족 여행 플래너 섹션 헤더 장식 (시즌/브랜딩 테마)
 * — `imageSrc`·크기·여백만 바꾸면 UI 전체가 함께 바뀝니다.
 */
export const travelPlannerHeaderDecorTheme = {
  /** `public/` 기준 정적 경로 (WebP 권장) */
  imageSrc: '/images/travel-planner-header-decor.webp',
  /** 제목·버튼 높이에 맞춘 프레임 높이 */
  frameHeight: 'clamp(34px, 8.5vw, 48px)',
  /** 가운데 슬롯에서 이미지 최대 너비 */
  frameMaxWidth: 'min(100%, 320px)',
  /** 타이틀·이미지·버튼 사이 간격 */
  slotGap: 'clamp(6px, 2vw, 12px)',
} as const;

export type TravelPlannerHeaderDecorTheme = typeof travelPlannerHeaderDecorTheme;
