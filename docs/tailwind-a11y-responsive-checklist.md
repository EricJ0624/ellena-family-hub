# Tailwind Integration A11y/Responsive Checklist

## Keyboard & Focus
- 모든 버튼/링크/입력 요소가 키보드(Tab/Shift+Tab/Enter/Space)로 조작 가능한지 확인
- 포커스 이동 시 시각적 포커스 표시가 유지되는지 확인
- 모달 오픈 시 포커스가 모달 내부로 이동하고, 닫힐 때 원위치되는지 확인

## States
- `hover/active/focus/disabled/loading` 상태가 버튼·입력·카드에서 일관적인지 확인
- 비동기 처리 중 `disabled`가 시각적으로 구분되고 오작동이 없는지 확인
- 오류/성공 메시지 색상 대비가 충분한지 확인

## Responsive
- 모바일(<=768), 태블릿, 데스크톱에서 다음 항목 점검
  - 텍스트 잘림/줄바꿈 의도 여부
  - 카드/그리드 오버플로우 여부
  - 모달 폭/높이 및 스크롤 동작
  - 터치 타깃 크기(버튼/아이콘 최소 40px 근접)

## Visual Regression Hotspots
- `TravelPlannerContent` 모달군(숙소/식당/관광/교통)
- `memories` sticky header + lightbox
- `dashboard` title fitting 구간
- `page` 로그인/가입 탭 전환

## Verify Commands
- `npx tsc --noEmit`
- `npm run lint`
- 필요 시 수동 시나리오 테스트 (로그인/대시보드/여행 플래너/추억 페이지)

