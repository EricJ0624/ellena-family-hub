# 가족 여행 플래너 · created_by / updated_by 설계

## 1. 목표

- **어떤 사용자가** 각 항목을 등록·수정했는지 DB에 저장하고, UI에 표시한다.
- 여행(Trip), 일정(Itinerary), 경비(Expense) 모두 동일한 패턴을 적용한다.

---

## 2. DB 스키마 변경

### 2.1 현재 상태

| 테이블               | created_by | updated_by |
|----------------------|------------|------------|
| travel_trips         | ✅ 있음    | ❌ 없음    |
| travel_itineraries   | ❌ 없음    | ❌ 없음    |
| travel_expenses      | ❌ 없음    | ❌ 없음    |

(모든 테이블에 `created_at`, `updated_at`은 이미 존재)

### 2.2 추가할 컬럼

**travel_trips**

- `updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL`  
  - 수정 시에만 설정. nullable.

**travel_itineraries**

- `created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL`  
  - INSERT 시 `created_by` 필수, UPDATE 시 `updated_by` 설정.

**travel_expenses**

- `created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL`

### 2.3 마이그레이션 SQL (요약)

```sql
-- travel_trips: updated_by 추가
ALTER TABLE public.travel_trips
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- travel_itineraries: created_by, updated_by 추가 (기존 row는 created_by를 채울 수 없으므로 기본값 불가)
-- 옵션 A: nullable로 추가 후 기존 row는 NULL, 신규만 채움
ALTER TABLE public.travel_itineraries
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.travel_itineraries
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- travel_expenses: 동일
ALTER TABLE public.travel_expenses
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.travel_expenses
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
```

- 기존 데이터가 이미 있다면 `created_by`를 NOT NULL로 두기 어렵기 때문에, **nullable**로 추가하고 **앞으로 INSERT되는 row만** `created_by`를 필수로 넣는 방식 권장.  
  (완전히 빈 테이블만 있다면 `NOT NULL`로 만들어도 됨.)

---

## 3. API 변경

### 3.1 INSERT 시

| API | 설정 값 |
|-----|---------|
| POST /api/v1/travel/trips | 이미 `created_by: user.id` 설정됨. `updated_by`는 null 유지. |
| POST …/itineraries | body에 `created_by` 넣지 않고, **서버에서 `created_by: user.id`** 설정. |
| POST …/expenses | 동일하게 **서버에서 `created_by: user.id`** 설정. |

- 클라이언트는 `created_by`를 보내지 않고, 서버가 `authenticateUser`로 얻은 `user.id`를 항상 사용.

### 3.2 UPDATE 시

| API | 설정 값 |
|-----|---------|
| PATCH …/trips/[tripId] | `updated_by: user.id`, `updated_at: now()` |
| PATCH …/itineraries/[id] | `updated_by: user.id`, `updated_at: now()` |
| PATCH …/expenses/[id] | `updated_by: user.id`, `updated_at: now()` |

- 수정이 일어날 때만 `updated_by`를 세팅하면 됨.

### 3.3 응답 (표시용 이름)

- API에서 **created_by / updated_by는 UUID만 반환**해도 됨.
- 표시 이름(nickname 등)은 다음 둘 중 하나로 처리 가능.
  - **방안 A (권장)**  
    - 클라이언트에서 **그룹 멤버 목록(또는 profiles)**을 한 번 조회해 `userId → nickname` 맵을 만든 뒤,  
      일정/경비/여행 목록을 그릴 때 `created_by`/`updated_by`를 이 맵으로 치환해 표시.
  - **방안 B**  
    - 서버에서 일정·경비·여행 조회 시 `profiles`와 join해서 `created_by_nickname`, `updated_by_nickname` 같은 필드를 붙여서 반환.

설계 단계에서는 **방안 A** 기준으로 UI를 설계해 두고, 필요 시 B로 전환 가능.

---

## 4. UI 표시 방법

### 4.1 표시할 데이터

- 각 항목(여행 카드, 일정 카드, 경비 카드)에 대해:
  - **등록:** `created_by` → 표시 이름 (nickname 우선, 없으면 email 일부)
  - **수정:** `updated_by`가 있을 때만 `"수정: {표시 이름}"` 표시

### 4.2 표시 이름 얻기 (클라이언트, 방안 A)

- **그룹 멤버 목록**이 이미 있다면 (대시보드 등에서 쓰는 것과 동일):
  - `members` 또는 `profiles`에서 `user_id` → `nickname` / `email` 매핑.
- 여행 플래너 전용이라면:
  - `/travel` 진입 시 **현재 그룹의 멤버 목록**을 한 번 조회  
    (예: `memberships` + `profiles` 또는 기존 그룹 멤버 API).
  - `Map<userId, string>` 형태로 저장 (표시명 = `nickname || email || '멤버'`).
- 각 항목의 `created_by` / `updated_by`는 UUID이므로, 이 맵으로 표시 문자열만 바꿔서 렌더링.

### 4.3 표시 위치 및 문구

**여행 목록 (왼쪽 카드)**

- 각 여행 한 줄 아래에 작은 글씨로:
  - `등록: {표시명}`  
  - (수정된 적 있으면) ` · 수정: {표시명}`  
- 예: `등록: 엄마 · 수정: 아빠`

**선택된 여행 상단(제목/날짜 블록)**

- 여행 자체의 `created_by` / `updated_by`가 있다면 동일하게:
  - `등록: {표시명}` / `수정: {표시명}`

**일정 목록 (오른쪽 일정 카드)**

- 각 일정 카드 하단에:
  - `등록: {표시명}`  
  - 수정 이력이 있으면 ` · 수정: {표시명}`  
- 폰트: 12px, 색상 `#94a3b8` 등 보조 텍스트 스타일.

**경비 목록 (오른쪽 경비 카드)**

- 각 경비 한 줄에:
  - 기존: `{category} | {amount}원`
  - 추가: 같은 줄 끝 또는 다음 줄에 `등록: {표시명}` (· 수정: {표시명})
- 한 줄에 넣기 어렵면 경비 카드를 2줄로 해서 두 번째 줄에 등록/수정 정보.

### 4.4 표시 예시 (문구만)

- 일정: `제주 공항 도착`  
  `2025-03-01`  
  `등록: 엄마 · 수정: 아빠`
- 경비: `교통비  12,000원`  
  `등록: 엄마`

### 4.5 created_by / updated_by가 없는 경우

- **기존 데이터** (마이그레이션으로 컬럼만 추가한 경우):
  - `created_by` / `updated_by`가 NULL이면 표시하지 않거나, `등록: -` / `수정: -` 처리.
- **신규 데이터**:
  - INSERT 시 항상 `created_by` 설정, 수정 시에만 `updated_by` 설정하면 됨.

---

## 5. 구현 순서 제안

1. **DB**  
   - `supabase_travel_planner.sql`에 위 ALTER 문 추가한 마이그레이션 파일을 만들거나, 별도 `supabase_travel_planner_created_updated_by.sql` 실행.
2. **타입**  
   - `lib/modules/travel-planner/types.ts`에 `created_by`, `updated_by` (optional) 필드 추가.
3. **API**  
   - POST itineraries/expenses: body에 `created_by` 넣지 않고 서버에서 `user.id` 설정.  
   - PATCH trips / itineraries / expenses: `updated_by: user.id`, `updated_at` 설정.  
   - GET 응답에는 이미 row가 그대로 오므로, 컬럼만 추가하면 `created_by`/`updated_by`가 포함됨.
4. **UI**  
   - 여행 플래너 페이지 로드 시 그룹 멤버(또는 profiles) 조회 → `userId → 표시명` 맵 생성.  
   - 여행 목록·선택된 여행·일정 목록·경비 목록에서 각각 `created_by`/`updated_by`를 맵으로 치환해 `등록: …` / `수정: …` 문구 표시.

---

## 6. 요약

| 구분 | 내용 |
|------|------|
| DB | trips: `updated_by` 추가. itineraries/expenses: `created_by`, `updated_by` 추가 (기존 row 고려 시 nullable 권장). |
| API | INSERT 시 서버가 `created_by = user.id`. UPDATE 시 서버가 `updated_by = user.id`. |
| UI | 그룹 멤버(또는 profiles)로 userId → 표시명 맵 만들고, 각 카드/행에 "등록: {표시명}"·"수정: {표시명}" 표시. |

이 설계대로 적용하면, 어떤 사용자가 입력·추가·수정했는지 DB에 남고 화면에도 동일하게 표시할 수 있다. 삭제는 “누가 삭제했는지”까지 남기려면 별도 감사 로그(예: admin_audit_log 같은) 테이블을 쓰는 방식이 필요하며, 이 설계 범위에는 포함하지 않았다.
