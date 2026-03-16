## Travel Planner 리팩토링 방향 메모

앞으로 여행 플래너 코드를 단순하게 만들기 위한 참고용 정리입니다.

### 1. 파일 분리 (컴포넌트 쪼개기)

- `TravelPlannerContent.tsx`를 역할별로 나누기:
  - `TravelPlannerLayout` (상단 요약, 여행 선택, 전체 레이아웃)
  - `ItineraryTimeline` (통합 일정 리스트 + “일정 PDF로 보기” 버튼)
  - `AccommodationSection`
  - `DiningSection`
  - `AttractionSection`
  - `TransportSection`
- 각 섹션 컴포넌트 안에서 자기 폼 모달까지 책임지게 해서, 메인 파일을 가볍게 만든다.

### 2. 공통 CRUD 훅 추출

- 패턴이 비슷한 섹션들을 훅으로 통일:
  - `useAccommodations(tripId)`
  - `useDining(tripId)`
  - `useAttractions(tripId)`
  - `useTransports(tripId)`
- 각 훅이 담당:
  - fetch (목록 조회)
  - create / update / delete
  - `show_in_itinerary` 토글
- 컴포넌트에서는 예를 들어 이렇게 사용:

```ts
const { items, create, update, remove, toggleShowInItinerary } = useAttractions(tripId);
```

### 3. 통합 일정 뷰 전용 타입 정의

- 통합 일정 뷰에서만 사용하는 전용 타입을 정의:

```ts
type UnifiedItineraryItem = {
  id: string;
  kind: 'accommodation' | 'dining' | 'attraction' | 'transport' | 'other';
  day_date: string;
  start_time?: string | null;
  end_time?: string | null;
  title: string;
  description?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  transport_type?: 'air' | 'train' | 'car' | 'bike';
};
```

- 통합 데이터를 만드는 함수를 별도로 둔다:

```ts
function buildUnifiedItineraries(
  accommodations,
  dining,
  attractions,
  transports,
  others
): UnifiedItineraryItem[] {
  // TODO: 병합 및 정렬 로직
}
```

- 타임라인, PDF, 이모지 표시는 이 타입만 바라보게 해서, 개별 테이블 구조 변경에 덜 영향을 받도록 한다.

### 4. 이모지/라벨 로직 중앙집중화

- 여러 곳에 흩어져 있는 이모지/타입 라벨 분기를 함수 하나로 통합:

```ts
function getUnifiedEmoji(item: UnifiedItineraryItem): string {
  // TODO: kind + transport_type 기준으로 이모지 결정
}

function getUnifiedLabel(item: UnifiedItineraryItem): string {
  // TODO: kind + transport_type 기준으로 라벨 결정
}
```

- 통합 일정 타임라인, PDF, (필요하면) 지도 모두 이 함수를 사용하도록 한다.

### 5. 모달 공통화 (선택 사항)

- 숙소/먹거리/관광지/교통 폼이 60~70% 정도 패턴이 비슷하면:
  - 공통 모달 래퍼 컴포넌트 (`BaseModal`)만 두고,
  - 내부 필드 구성은 섹션별로 유지
- 지나친 추상화는 오히려 헷갈릴 수 있으니, “중복이 진짜 거슬리는 부분” 위주로만 공통화한다.

