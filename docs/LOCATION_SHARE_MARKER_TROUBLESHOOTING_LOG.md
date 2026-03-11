# 위치공유 마커 이슈 — 수정 이력 및 참고 문서

위치공유 승인 후 지도 마커가 **나왔다가 사라지거나**, **요청한 쪽 지도에 아예 안 뜨는** 현상에 대해 진행한 **모든 수정 사항**을 기록합니다. 다음에 Sonnet 등이 동일 이슈를 참고할 수 있도록 정리했습니다.

---

## 1. 증상 요약

- **승인한 쪽**: 마커가 한 번 나왔다가 사라짐 / 나왔다 사라졌다 다시 나왔다가 또 사라짐.
- **요청한 쪽**: 승인한 사람의 마커가 지도에 표시되지 않음.
- **원인 요약**: `loadFamilyLocations()`가 여러 경로(직접 호출, Realtime `location_requests` UPDATE, Realtime `user_locations` INSERT/UPDATE)에서 동시에 호출되며, API/DB 타이밍에 따라 **stale 결과**(승인 반영 전 데이터)로 `familyLocations`가 덮어씌워짐. `updateMapMarkers()`는 `familyLocations`에 없는 사용자 마커를 제거하므로, 그 순간 마커가 사라짐.

---

## 2. 수정 사항 목록 (진행 순서)

### 2.1 loadFamilyLocations — merge 로직 + 빈 배열 덮어쓰기 방지

- **파일**: `app/dashboard/page.tsx`
- **위치**: `loadFamilyLocations` 내부, `setState` 호출부
- **내용**:
  - **표시 대상 기준**: `currentLocationRequests`에서 `status === 'accepted'`인 요청의 상대방 ID 집합 `expectedUserIds` 계산.
  - **데이터 있을 때**: 새 fetch 결과 `locations`와 `prev.familyLocations`를 **merge**. `expectedUserIds` 기준으로, 새 데이터 있으면 사용, 없으면 prev 유지. 단, `expectedUserIds.size === 0 && merged.length === 0`이면 **prev 유지** (API stale 시 `[]`로 덮어쓰지 않음).
  - **데이터 없을 때**: `expectedUserIds.size > 0`이면 prev 유지. `expectedUserIds.size === 0`이면 **취소/거절이 있을 때만** `familyLocations: []`로 설정.
- **의도**: 승인된 사용자는 stale fetch여도 목록에서 빠지지 않게 함.
- **커밋**: `fix(dashboard): 위치공유 마커 근본 해결 - merge 로직 적용 및 레이스 방지 코드 제거`

### 2.2 loadFamilyLocations — API stale 시 expectedUserIds 비어있어도 prev 유지

- **파일**: `app/dashboard/page.tsx`
- **내용**:
  - **데이터 있는 분기**: `expectedUserIds.size === 0 && merged.length === 0`이면 **무조건** `return prev` (빈 배열로 덮어쓰지 않음).
  - **데이터 없는 분기**: `expectedUserIds.size === 0 && !hasCancelledOrRejected`이면 `return prev`. 취소/거절이 있을 때만 `[]`로 설정.
- **커밋**: `fix(dashboard): API stale 시 expectedUserIds 비어있어도 마커 유지`

### 2.3 loadFamilyLocations — expectedUserIds 비어있을 때 [] 덮어쓰기 완전 차단

- **파일**: `app/dashboard/page.tsx`
- **내용**: 위와 동일한 방어를 유지하고, 주석/조건을 명확히 함. stale 로드가 먼저 완료돼도 `prev`가 `[]`인 경우에 빈 배열로 덮어쓰지 않도록 함.
- **커밋**: `fix(dashboard): expectedUserIds 비어있을 때 [] 덮어쓰기 완전 차단`

### 2.4 주소 변환 비동기 콜백 — familyLocations 빈 배열 덮어쓰기 방지

- **파일**: `app/dashboard/page.tsx`
- **위치**: `loadFamilyLocations` 내부, `.map()` 안의 비동기 IIFE — 주소 변환 성공 시 `setState(prev => ({ ...prev, familyLocations: prev.familyLocations.map(...) }))`
- **내용**: `prev.familyLocations`가 비어 있거나, 해당 `loc.user_id`가 목록에 없으면 **setState 스킵** (`return prev`). 이 경로에서 `[]`로 덮어쓰는 일이 없도록 함.
- **커밋**: `fix(dashboard): 주소 변환 비동기 콜백이 familyLocations를 []로 덮어쓰지 않도록 방지`

### 2.5 updateMapMarkers — 승인된 사용자 마커 제거하지 않기 (지도 레이어 방어)

- **파일**: `app/dashboard/page.tsx`
- **위치**: `updateMapMarkers` 내부, "familyLocations에 없는 사용자의 마커 제거" 블록
- **내용**:
  - `locationRequests`에서 `status === 'accepted'`인 상대 ID 집합 `acceptedFromState` 계산.
  - 마커 제거 시: `currentUserIds`에 없어도 **`acceptedFromState`에 있으면 제거하지 않음**.
  - `useCallback` 의존성에 `locationRequests` 추가.
- **의도**: 상태가 일시적으로 잘못되어도, 지도에서는 "승인된 사용자" 마커를 지우지 않음.
- **커밋**: `fix(dashboard): 지도에서 승인된 위치공유 사용자 마커 제거하지 않기`

### 2.6 acceptedUserIdsRef 도입 — 승인 직후 ref에 상대 ID 등록 (첫 사라짐 방지)

- **파일**: `app/dashboard/page.tsx`
- **내용**:
  - **Ref 추가**: `acceptedUserIdsRef = useRef<Set<string>>(new Set())`.
  - **추가 시점**:  
    - `handleLocationRequestAction`에서 `result.success && action === 'accept'` 직후, `currentRequest` 또는 `result.data`로 상대 ID를 구해 ref에 추가.  
    - Realtime `location_requests` UPDATE에서 `payload.new.status === 'accepted'` 수신 직후(첫 `await` 전) 상대 ID를 ref에 추가.
  - **제거 시점**:  
    - `handleLocationRequestAction`에서 `action === 'reject'` 또는 `action === 'cancel'` 시 해당 상대 ID를 ref에서 제거.  
    - Realtime에서 `cancelled`/`rejected` 수신 시에는 **즉시 제거하지 않고**, 아래 2.7처럼 갱신된 목록 확인 후 제거.
  - **updateMapMarkers**: `acceptedFromState`에 없어도 **`acceptedUserIdsRef.current.has(markerUserId)`이면 마커 제거하지 않음**.
- **커밋**: `fix(dashboard): 승인 직후 acceptedUserIdsRef로 마커 첫 사라짐 방지`

### 2.7 Realtime 취소/거절 시 ref 제거 — 갱신된 목록 기준으로만 제거

- **파일**: `app/dashboard/page.tsx`
- **위치**: Realtime `location_requests` UPDATE 핸들러
- **내용**:  
  - `cancelled`/`rejected` 수신 시 해당 요청의 상대 ID를 **즉시 ref에서 제거하지 않음**.  
  - `loadLocationRequests()` 완료 후, `/api/location-request`로 **갱신된 목록**을 다시 조회.  
  - 그 목록에 "해당 상대와의 accepted 요청"이 **하나도 없을 때만** ref에서 해당 ID 제거.  
  - (동일 두 사용자에게 예전 요청은 취소, 새 요청은 accepted인 경우 잘못 제거되지 않도록 함.)
- **커밋**: `fix(dashboard): 위치 마커 전체 보강 - ref 제거 조건·요청자 재시도·승인 fallback`

### 2.8 updateMapMarkers — ref에서의 제거 로직 제거

- **파일**: `app/dashboard/page.tsx`
- **위치**: `updateMapMarkers` 내부, `locationRequests` 순회하는 부분
- **내용**: `locationRequests`에서 `cancelled`/`rejected`일 때 ref에서 delete하던 코드 **제거**. ref 제거는 Realtime/핸들러에서만 수행.
- **커밋**: `fix(dashboard): 위치 마커 유지 + 요청자 지도에 승인자 마커 표시`

### 2.9 요청한 쪽 — accepted 수신 후 재시도 로드

- **파일**: `app/dashboard/page.tsx`
- **위치**: Realtime `location_requests` UPDATE 핸들러, `updatedRequest.status === 'accepted'` 블록
- **내용**: **요청자**(`updatedRequest.requester_id === userId`)가 accepted 이벤트를 받으면, **1초 / 2.5초 / 4.5초** 후에 각각 `loadFamilyLocations()` + `updateMapMarkers()` 호출. 승인자가 위치를 저장할 시간을 두고 재시도해, 요청자 지도에 승인자 마커가 뜨도록 함.
- **커밋**: `fix(dashboard): 위치 마커 전체 보강 - ref 제거 조건·요청자 재시도·승인 fallback`

### 2.10 승인 시 ref 추가 fallback (API 응답 사용)

- **파일**: `app/dashboard/page.tsx`
- **위치**: `handleLocationRequestAction`, `result.success && action === 'accept'` 블록
- **내용**: ref에 추가할 상대 ID를 `currentRequest`뿐 아니라 **`result.data`**(승인 API가 반환한 업데이트된 요청)에서도 계산. `currentRequest`가 없어도 API 응답으로 ref에 등록되도록 함.
- **커밋**: `fix(dashboard): 위치 마커 전체 보강 - ref 제거 조건·요청자 재시도·승인 fallback`

### 2.11 지도 마커 갱신 디바운스 (500ms)

- **파일**: `app/dashboard/page.tsx`
- **내용**:
  - **Ref 추가**: `updateMapMarkersDebounceRef = useRef<NodeJS.Timeout | null>(null)`.
  - 지도가 **이미 로드된 상태**에서만: `initializeMap()` 호출을 **500ms 디바운스**. `familyLocations`/`locationRequests` 등이 연속으로 바뀌어도, 마지막 변경 기준 500ms 뒤에 한 번만 `initializeMap()` → `updateMapMarkers()` 실행.
  - 첫 로드(스크립트 로드 후 최초 초기화)는 디바운스 없이 실행.
  - effect cleanup에서 디바운스 타이머 clear.
- **의도**: 중간 상태(예: `familyLocations`가 잠깐 `[]`)로 `updateMapMarkers`가 여러 번 호출되는 것을 줄여, 마커가 사라지는 현상 완화.
- **커밋**: `fix(dashboard): 지도 마커 갱신 디바운스 500ms 적용`

---

## 3. 관련 코드 위치 요약

| 구분 | 파일 | 대략적 위치 |
|------|------|-------------|
| acceptedUserIdsRef | `app/dashboard/page.tsx` | ref 선언부(~315행 근처) |
| ref 추가 (승인) | `app/dashboard/page.tsx` | `handleLocationRequestAction` 내부, `result.success && action === 'accept'` |
| ref 추가 (Realtime) | `app/dashboard/page.tsx` | Realtime `location_requests` UPDATE 핸들러 맨 앞 |
| ref 제거 (취소/거절) | `app/dashboard/page.tsx` | Realtime 핸들러 내 `loadLocationRequests()` 후, API로 목록 재조회 후 조건부 delete |
| ref 제거 (핸들러) | `app/dashboard/page.tsx` | `handleLocationRequestAction` 내 `action === 'reject' \|\| 'cancel'` |
| loadFamilyLocations | `app/dashboard/page.tsx` | `loadFamilyLocations` 함수 전체 — expectedUserIds, merge, 빈 배열 방지, 주소 콜백 방지 |
| updateMapMarkers | `app/dashboard/page.tsx` | `updateMapMarkers` — currentUserIds, acceptedFromState, acceptedUserIdsRef 체크, 제거 시 ref 사용 |
| 지도 useEffect | `app/dashboard/page.tsx` | Google Maps 초기화 useEffect — 디바운스 ref, 500ms setTimeout, cleanup |

---

## 4. 참고 사항 (Sonnet 등 참고용)

- **마커 표시/제거 기준**:  
  - **그리기**: `state.familyLocations`를 순회하며 각 사용자별 마커 생성/갱신.  
  - **제거**: `familyLocations`에 없고, `locationRequests`의 accepted에도 없고, **`acceptedUserIdsRef`에도 없으면** 제거.  
  - 따라서 ref는 "승인 직후 state가 따라오기 전까지" 또는 "stale 덮어쓰기" 시에도 마커가 지워지지 않게 하는 **보험** 역할.
- **문제가 계속될 수 있는 경우**:  
  - Realtime/API 지연·순서가 달라 ref 추가 전에 `updateMapMarkers`가 실행되는 경우.  
  - 다른 탭/기기에서 취소했을 때 ref는 로컬만 반영되어, 상대방 마커가 취소 후에도 남을 수 있음.  
  - 요청자 쪽은 "승인자 위치 저장" 시점에 따라 1/2.5/4.5초 재시도로도 안 뜰 수 있음 (네트워크·RLS 등).
- **추가로 시도해 볼 수 있는 것**:  
  - ref를 "영구 보존"하지 않고, 주기적으로 `locationRequests`와 동기화하되 **같은 (requester, target) 쌍에 accepted가 하나라도 있으면 ref에 유지**하는 정책.  
  - 요청자 전용으로 `user_locations` Realtime에만 의존해, INSERT/UPDATE 시점에만 `loadFamilyLocations` 호출하고, `location_requests` UPDATE 시에는 재시도만 하기.  
  - 디바운스 시간을 700ms~1s로 늘려 보기.

---

## 5. 관련 커밋 메시지 목록 (검색용)

- `fix(dashboard): 위치공유 승인 후 마커가 사라지는 레이스 방지`
- `fix(dashboard): 위치공유 마커 근본 해결 - merge 로직 적용 및 레이스 방지 코드 제거`
- `fix(dashboard): API stale 시 expectedUserIds 비어있어도 마커 유지`
- `fix(dashboard): expectedUserIds 비어있을 때 [] 덮어쓰기 완전 차단`
- `fix(dashboard): 주소 변환 비동기 콜백이 familyLocations를 []로 덮어쓰지 않도록 방지`
- `fix(dashboard): 지도에서 승인된 위치공유 사용자 마커 제거하지 않기`
- `fix(dashboard): 승인 직후 acceptedUserIdsRef로 마커 첫 사라짐 방지`
- `fix(dashboard): 위치 마커 유지 + 요청자 지도에 승인자 마커 표시`
- `fix(dashboard): 위치 마커 전체 보강 - ref 제거 조건·요청자 재시도·승인 fallback`
- `fix(dashboard): 지도 마커 갱신 디바운스 500ms 적용`

---

*마지막 업데이트: 위치공유 마커 이슈 수정 이력 정리.*
