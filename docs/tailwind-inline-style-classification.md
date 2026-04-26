# Tailwind Inline Style Classification (Stage 2)

## Scope
- 기준: `app/**/*.tsx`의 `style={{` 잔여 항목
- 원칙: 기능/권한/연동/보안 로직 불변, 스타일 계층만 정리

## Classification Rules
- **A (즉시 전환 가능)**: 정적 값, Tailwind 유틸로 동일 표현 가능
- **B (변수화 가능)**: 동적 값이지만 CSS 변수 주입 후 클래스 중심으로 전환 가능
- **C (유지)**: 런타임 계산/브라우저 이벤트/캔버스급 표현 결합으로 인라인 유지가 안전

## File-by-File

### `app/components/TitlePage.tsx`
- **A**: 없음 (정적 항목은 대부분 전환 완료)
- **B**
  - 슬라이더 배경 진행률 2건 (`fontSizeProgress`, `letterSpacingProgress`)
- **C**
  - `frame.color` 미리보기 색상
  - 타이틀 실시간 스타일(`fontSize/fontFamily/fontWeight/letterSpacing/color`)

### `app/features/family-chat/components/FamilyChatSection.tsx`
- **A**: 없음
- **B**
  - 섹션 타이틀 폰트 사이즈 피팅
  - 말풍선 텍스트 폰트 사이즈 피팅
- **C**
  - 말풍선 wrapper의 동적 `width/height`(레이아웃 계산값)

### `app/page.tsx`
- **A**: 없음
- **B**
  - 루트 `fontFamily` (언어별 본문 폰트)
  - 로그인 타이틀 `fontSize/fontFamily/fontWeight`(피팅 + 언어별 폰트)
- **C**: 없음

### `app/modules/travel-planner/TravelPlannerContent.tsx`
- **A**: 없음
- **B**: 없음
- **C**
  - 지도 placeholder의 `backgroundImage` (이미지+overlay 특수 표현)

### `app/memories/page.tsx`
- **A**: 없음
- **B**
  - sticky header의 `maxWidth`, `padding`, `gap`, CSS 변수(`--hs`) 주입
- **C**
  - lightbox 뷰포트 동기화(`visualViewport` 기반 top/left/width/height)

### `app/features/family-calendar/components/FamilyCalendarSection.tsx`
- **A**: 없음
- **B**
  - 캘린더 셀/텍스트 동적 크기 계산
- **C**: 없음

### `app/dashboard/page.tsx`
- **A**: 없음
- **B**
  - 본문 `fontFamily`
  - 대시보드 타이틀 피팅 `fontSize` 병합
- **C**: 없음

### `app/admin/page.tsx`
- **A**: 없음
- **B**
  - 저장소 사용량 등 동적 시각값(폭/색 계열)
- **C**: 없음

### `app/components/AnnouncementBanner.tsx`
- **A**: 없음
- **B**: 없음
- **C**
  - marquee 애니메이션/거리 계산 기반 인라인 스타일

## Operational Decision
- Stage 2 이후에도 C는 유지한다.
- B는 화면 단위 리팩터링 시 CSS 변수 주입 방식으로 점진 전환한다.
- 새 인라인 스타일 추가 시 반드시 A/B/C 분류 근거를 PR에 포함한다.

