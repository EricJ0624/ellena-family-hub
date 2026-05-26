# ADR: 위젯 DnD·리사이즈·돋보기 레이아웃 시스템

**날짜**: 2026-05-26  
**상태**: 초안 — 사용자 승인 대기  
**범위**: Phase 1–6 전체 (표현 + 관리 UI + DB 컬럼)  
**제한**: 인증·RLS 정책·`/auth/callback`·API 라우트 동작 변경 없음

---

## 1. 현재 상태 (As-Is)

| 파일 | 현재 역할 |
|------|-----------|
| `lib/widgets/types.ts` | `WidgetSize`, `WIDGET_SIZE_PRESETS`, `WidgetConfigDraft` |
| `lib/widgets/grid.ts` | `getDashboardColumnCount`, `resolveWidgetGridSpans`, `getLandscapeColumnCountForWidgets`, `getDeviceMaxUsableGridWidth` |
| `lib/widgets/use-dashboard-columns.ts` | `useDashboardGridLayout(ref, orientation, active, widgetConfigs)` — widgetConfigs 이미 인수로 받음 |
| `widget_configs` DB | `size TEXT`, `col_span INT(1-4)`, `row_span INT(1-6)` — **x/y 위치 없음** |
| `DashboardWidgetSettings.tsx` | S/M/L `<select>` + ▲▼ 순서 조정 |
| `app/dashboard/page.tsx` | `visibilitychange` 시 `ensureWidgetConfigs` 재로드, Realtime **없음** |
| `config/inline-style-allowlist.json` | `app/dashboard/page.tsx`: 2개 허용 |

**핵심 확인 사항**:
- `framer-motion ^12` 이미 설치됨.
- `react-grid-layout` 설치되어 **있지 않음**.
- Tailwind CSS v4 사용 — `@container` 네이티브 지원, 플러그인 불필요.
- `useDashboardGridLayout`이 이미 `widgetConfigs`를 받아 열 수에 반영.
- `widgetConfigs`는 Realtime 구독 없이 `visibilitychange`로만 새로고침.

---

## 2. 결정 사항 (Decisions)

### D-1. DnD·리사이즈 라이브러리: `@dnd-kit/core` + `@dnd-kit/sortable`

**선택**: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`

**거부된 대안**:

| 라이브러리 | 거부 이유 |
|-----------|----------|
| `react-grid-layout` | React 19 `findDOMNode` 미호환, 마지막 안정 릴리스 기준 React 18까지 공식 지원 |
| `framer-motion` DnD | Reorder 컴포넌트는 1D 정렬 전용 — 2D 그리드 DnD·리사이즈 미지원 |
| 자체 pointer events | 겹침 방지·snap·접근성(키보드 DnD) 직접 구현 비용 과다 |

**리사이즈 핸들**: `@dnd-kit`의 DragOverlay + 별도 리사이즈 핸들 컴포넌트 (pointer events) 조합.  
`framer-motion`은 애니메이션(카드 Enter/Leave, 크기 전환 transition)에만 활용.

---

### D-2. 좌표계: 12열 정규화 그리드 (B안)

**선택**: DB 저장은 12열 정규화, 렌더는 기존 `repeat(N, 1fr)` 유지

```
저장값: layout_x, layout_y, layout_w, layout_h  (numeric, 12열 기준)
렌더:   actualCol = clamp(round(layout_w * dashboardColumnCount / 12), 1, dashboardColumnCount)
        gridColumn = `span ${actualCol} / span ${actualCol}`
```

**B안 선택 이유**:
- 기존 CSS(`data-columns`, `data-widget-size`, `grid-auto-rows` 등 `globals.css` 규칙) **무변경**.
- `resolveWidgetGridSpans` 폴백 동작 유지.
- A안(CSS도 12열 고정)은 `globals.css` 전체 재작성 필요 — 회귀 위험 과다.

**12열 기준 단위**:

| actualCols | 1칸 = 몇 단위 | 예시 |
|-----------|--------------|------|
| 1열 | 12 | w=12 (전체) |
| 2열 | 6 | w=6 (1/2), w=12 (전체) |
| 3열 | 4 | w=4, w=8, w=12 |
| 4열 | 3 | w=3, w=6, w=9, w=12 |

**소수 단위 의미**: `w=4.5` → 2열 그리드에서 `round(4.5×2/12)=1`, 4열에서 `round(4.5×4/12)=2`. 저장은 소수, 렌더는 정수 snap. 완전한 소수 픽셀 렌더를 원할 경우 Phase 5 이후 CSS Grid subgrid 검토.

---

### D-3. DB 컬럼 설계

**추가 컬럼** (기존 `col_span`, `row_span`, `size` 유지 — 폴백 + 복구 기준):

```sql
layout_x    numeric(6,3)  nullable  -- 0 이상
layout_y    numeric(6,3)  nullable  -- 0 이상
layout_w    numeric(6,3)  nullable  -- 0 초과
layout_h    numeric(6,3)  nullable  -- 0 초과
-- CHECK: layout_x IS NULL OR layout_x >= 0
-- CHECK: layout_y IS NULL OR layout_y >= 0
-- CHECK: layout_w IS NULL OR (layout_w > 0 AND layout_x + layout_w <= 12)
-- CHECK: layout_h IS NULL OR layout_h > 0
layout_version  integer  not null default 1
```

**nullable 이유**: 마이그레이션 직후 기존 행은 null → 렌더 시 `resolveWidgetGridSpans` 폴백.  
**layout_version**: 향후 포맷 변경 시 마이그레이션 판단용.

**`col_span`·`row_span` 역할 변경**:
- Phase 3 이전: 렌더 기준 (기존 동작 유지)
- Phase 3 이후: `layout_w/h`가 null이 아닌 경우 렌더는 `layout_*` 우선, `col_span`은 **복구 기준값**으로 보존

---

### D-4. S/M/L 역할 재정의 (프리셋 → 복구 템플릿)

`WIDGET_SIZE_PRESETS`·`applySizePreset`·`parseWidgetSize` **삭제 금지**.

| Phase 전 | Phase 3 이후 |
|----------|-------------|
| S/M/L `<select>` → `col_span`·`row_span` 직접 적용 | "기본 크기·위치 복구" 버튼 → `size` 기준 12열 시드 → `layout_*` 초기화 |

**위젯별 기본 size**:

| 위젯 | 기본 size | 이유 |
|------|-----------|------|
| `tasks` | M | 할 일 목록, 보통 크기 |
| `calendar` | M | 한 달 보기, 보통 크기 |
| `chat` | L | 대화 흐름 — 가로 넓이 필요 |
| `location` | M | 지도 축소판 |
| `album` | L | 이미지 그리드 |
| `travel` | M | 여행 카드 목록 |
| `piggy` | M | 저금통 요약 |

---

### D-5. CSS 렌더 방식: 기존 유지 + `resolveWidgetGridPlacement` 신규

```
기존: resolveWidgetGridSpans(cfg, columnCount) → { colSpan, rowSpan }
신규: resolveWidgetGridPlacement(cfg, columnCount) → { colSpan, rowSpan, gridColumnStart? }
     - layout_x가 null이 아니면 gridColumnStart = round(layout_x * columnCount / 12) + 1
     - layout_w가 null이 아니면 colSpan = clamp(round(layout_w * columnCount / 12), 1, columnCount)
     - null이면 기존 resolveWidgetGridSpans 폴백
```

---

### D-6. Realtime 정책

**결정**: Phase 3 완료 시까지 **현행 유지** (visibilitychange 새로고침).

- `widget_configs` 변경은 오너만 가능 (RLS). 멤버는 편집 불가 → 실시간 동기화 우선순위 낮음.
- Phase 5+ 에서 Realtime subscription 추가 여부를 별도 검토. 현재는 그룹 관리에서 저장 후 대시보드 방문 시 자동 반영.

---

### D-7. 돋보기(팝업) 데이터 공유 방식

**결정**: `WidgetMagnifyModal`은 독립 마운트 **금지**. 기존 위젯 컴포넌트를 prop으로 전달받은 데이터로 렌더.

- 위젯별 데이터(`tasks`, `chat` 등)는 `page.tsx`의 기존 state/구독 공유.
- 팝업 열림 시 Supabase 구독 추가 등록 없음.
- `chat` 위젯 팝업: `max-height: 100dvh`, `env(safe-area-inset-bottom)` padding.

---

### D-8. 인라인 스타일 allowlist

`WidgetLayoutEditor`(Phase 3)에서 DnD 드래그 transform이 인라인으로 발생.  
Phase 3 완료 후 `config/inline-style-allowlist.json`에 해당 파일 추가 필요.  
현재 `app/dashboard/page.tsx`: 2개 허용 — Phase 2까지 초과 금지.

---

## 3. 위젯별 12열 시드 좌표 (7위젯 모두 활성 시 기본 배치)

**배치 원칙**: 2열 기준(모바일 기본), display_order 순 top-left 패킹.  
복구 버튼 클릭 시 아래 값으로 `layout_*` 초기화 + `col_span`·`row_span` 동기화.

### 전체 활성(7개) — 2열 기준 (12열 단위, y는 순차 자동배치)

| widget_key | size | w | h | col_span | row_span | 비고 |
|-----------|------|---|---|----------|----------|------|
| tasks | M | 6 | 3 | 1 | 1 | 절반 너비, 보통 높이 |
| calendar | M | 6 | 3 | 1 | 1 | tasks 옆 또는 다음 행 |
| chat | L | 12 | 4 | 2 | 1 | 전체 너비, 대화 공간 |
| location | M | 6 | 3 | 1 | 1 | 지도 축소판 |
| album | L | 12 | 5 | 2 | 1 | 전체 너비, 이미지 그리드 |
| travel | M | 6 | 3 | 1 | 1 | 여행 카드 |
| piggy | M | 6 | 3 | 1 | 1 | 저금통 요약 |

### 4열 렌더 시 변환 예시 (actualCols=4)

| widget_key | w=12 | actualCol = round(w×4/12) |
|-----------|------|--------------------------|
| tasks | 6 | round(6×4/12) = **2** |
| chat | 12 | round(12×4/12) = **4** (전체) |
| album | 12 | **4** |

### 2열 렌더 시 변환 예시 (actualCols=2)

| widget_key | w | actualCol = round(w×2/12) |
|-----------|---|--------------------------|
| tasks | 6 | **1** |
| chat | 12 | **2** |

### `packLayoutsFromOrder` 알고리즘 (복구 시)

```
1. widgets를 display_order 오름차순 정렬
2. BASE_COLS=12 그리드, 현재 y=0, x=0
3. 각 위젯:
   a. preset에서 w 가져옴
   b. 현재 행 x + w <= 12 이면 배치: layout_x=x, layout_y=y → x += w
   c. 초과하면 다음 행: y += prevRowMaxH, x=0, 재시도
4. layout_y는 h 단위 누적 (초기 h: tasks/calendar/location/travel/piggy = 3, chat/album = 4~5)
```

---

## 4. Phase 1–6 체크리스트

### Phase 1 — DB + 타입 레이어 (UI 변경 없음)

**목표**: `layout_*` 컬럼 추가, TypeScript 타입 동기화, 시드 트리거 업데이트

**작업**:
- [ ] `supabase_widget_configs_layout_v2.sql` 작성
  - `layout_x/y/w/h numeric(6,3) nullable` + CHECK 제약
  - `layout_version integer not null default 1`
  - 기존 `col_span(1-4)`, `row_span(1-6)` CHECK 유지
- [ ] `seed_widget_configs_for_new_group` 트리거 함수 수정 — `layout_*` 기본값 포함
- [ ] `lib/widgets/types.ts`: `WidgetConfigDraft`에 `layoutX/Y/W/H: number | null`, `layoutVersion: number` 추가
- [ ] `types/db.ts`: `widget_configs` `Row`/`Insert`/`Update` 에 `layout_*` 컬럼 추가
- [ ] `lib/widgets/types.ts`: `WIDGET_LAYOUT_PRESETS` 신규 export (D-3 시드 표 기준 w,h)
- [ ] `lib/widgets/widget-configs.ts`: `select` 쿼리에 `layout_*` 포함, `normalizeRows` + `saveWidgetConfigs` 업데이트
- [ ] `lib/widgets/layout-presets.ts` 신규: `getPresetLayout(key, size)`, `packLayoutsFromOrder(widgets)`

**검증**:
- [ ] `pnpm exec tsc --noEmit` 통과
- [ ] `pnpm lint` 통과
- [ ] MCP `execute_sql`로 `widget_configs` 컬럼 확인
- [ ] 기존 그룹 `loadWidgetConfigs` — layout_* null로 정상 로드

---

### Phase 2 — 렌더 엔진 (대시보드 폴백 연동)

**목표**: `layout_*` 우선, null이면 `resolveWidgetGridSpans` 폴백

**작업**:
- [ ] `lib/widgets/grid.ts`: `resolveWidgetGridPlacement(cfg, columnCount)` 신규 추가
  - layout_w/h null → 기존 `resolveWidgetGridSpans` 호출
  - layout_x null이 아니면 `gridColumnStart` 계산
- [ ] `app/dashboard/page.tsx`: `resolveWidgetGridSpans` → `resolveWidgetGridPlacement` 교체
  - `gridColumnStart` 있으면 `style.gridColumnStart` 추가
  - **인라인 스타일 수 2개 유지** (allowlist 초과 금지)
- [ ] `use-dashboard-columns.ts`: `widgetConfigs` 의존성 배열 안정화 확인 (useMemo wrap)

**검증**:
- [ ] layout_* null인 기존 위젯 → 기존 span 동일하게 렌더
- [ ] layout_w=6 저장 후 2열 → col=1, 4열 → col=2
- [ ] `check:inline-styles` 통과 (`pnpm run check:inline-styles`)

---

### Phase 3 — 그룹 관리 DnD + 리사이즈 편집기

**목표**: S/M/L select 교체 → DnD 그리드 편집기 + "기본 복구" 버튼

**작업**:
- [ ] `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` 설치
- [ ] `app/components/group-admin/WidgetLayoutEditor.tsx` 신규
  - 12열 정규화 그리드 미리보기
  - 각 위젯 카드: DnD 이동 + 리사이즈 핸들 (우하단 + 우측)
  - 편집 중 `validateLayoutNoOverlap()` 실시간 검사 (겹침 시 red outline)
  - 세로/가로 토글 (`preview-orientation.ts` 재사용)
  - `preventCollision`: 겹치는 위치에 드롭 불가 처리
- [ ] `DashboardWidgetSettings.tsx` 수정
  - S/M/L `<select>` → `WidgetLayoutEditor` 임베드
  - "기본 크기·위치 복구 (전체)" 버튼: `packLayoutsFromOrder` 호출
  - 위젯별 "복구" 버튼: `getPresetLayout(key, size)` 호출
  - 기존 `showAdvancedLayout` 숫자 span 입력: dev 전용 유지
- [ ] `lib/translations/groupAdmin.ts`: `widgets_restore_defaults`, `widgets_restore_all`, `widgets_layout_edit_hint` 5개 언어 추가
- [ ] `config/inline-style-allowlist.json`: `WidgetLayoutEditor.tsx` 항목 추가
- [ ] `saveWidgetConfigs`: `layout_*` 포함 저장 + `col_span/row_span` 동기화

**모바일 편집기 정책**:
- `isTouchOnlyDevice()` 가 true인 경우 DnD 대신 "PC에서 편집하세요" 안내 표시
- 터치 기기에서도 기본 복구 버튼과 ON/OFF 토글은 동작

**검증**:
- [ ] 오너만 편집, 멤버 read-only 유지
- [ ] 저장 후 대시보드 `resolveWidgetGridPlacement` 결과 동일
- [ ] 겹침 드롭 불가 동작 확인
- [ ] 복구 버튼 → `WIDGET_SIZE_PRESETS` 기준 layout 초기화
- [ ] `check:inline-styles` 통과
- [ ] tsc, lint 통과

---

### Phase 4 — WidgetChrome: 비율 유지 스케일링

**목표**: 위젯 크기 변해도 내부 콘텐츠 비율 유지

**작업**:
- [ ] `app/components/dashboard/WidgetChrome.tsx` 신규
  - `container-type: inline-size` (기존 `.chalkboard-frame` 패턴 참조)
  - 자식에 `cqw`/`cqi` 기반 font-size clamp
  - 이미지: `object-fit: contain`, `max-h-full`
  - 이모지/아이콘: `em`/`rem` 단위
  - props: `widgetKey`, `layoutW`, `layoutH`, `onExpand`, `children`
- [ ] `app/dashboard/page.tsx`: `renderWidgetSection` 래핑 — 로직 변경 없음
- [ ] `globals.css` `.chalkboard-frame` 패턴 → WidgetChrome 공통 CSS로 흡수 검토

**검증**:
- [ ] S 크기 → 텍스트 clamp 확인
- [ ] XL 크기 → 이미지 object-fit 확인
- [ ] 430px portrait / 900px landscape / 모바일 회전

---

### Phase 5 — 돋보기(팝업) 모드

**목표**: 너무 작은 위젯 → 팝업에서 전체 기능 사용

**작업**:
- [ ] `lib/widgets/layout-constants.ts`: `USABILITY_MIN_W_PX = 160`, `USABILITY_MIN_H_PX = 120`
- [ ] `WidgetChrome` 수정: 렌더 크기 < threshold → 🔍 버튼 노출
- [ ] `app/components/dashboard/WidgetMagnifyModal.tsx` 신규
  - Dialog (focus trap, ESC, backdrop close)
  - 데이터는 `page.tsx` state·context 공유 — 독립 fetch/구독 **금지**
  - `chat` 위젯: `max-height: 100dvh`, `padding-bottom: env(safe-area-inset-bottom)`
  - `framer-motion` AnimatePresence로 Enter/Leave 애니메이션
- [ ] `lib/translations/dashboard.ts`: `widgets_magnify_open`, `widgets_magnify_close` 5개 언어

**검증**:
- [ ] 160px 미만 위젯에서 🔍 버튼 노출
- [ ] 팝업 내 할 일 체크, 채팅 입력 동작
- [ ] 팝업 닫으면 그리드 레이아웃 유지
- [ ] 모바일 소프트 키보드 → 팝업 컨텐츠 잘림 없음
- [ ] Supabase 구독 중복 등록 없음 (개발자 도구 확인)

---

### Phase 6 — 백필·회귀·정리

**목표**: 프로덕션 데이터 백필, 전체 회귀 통과, 문서화

**작업**:
- [ ] `layout-migrate.ts`: 기존 `col_span/row_span/display_order` → `layout_*` 변환 + `packLayoutsFromOrder` 적용
- [ ] MCP `execute_sql`로 기존 그룹 백필 실행 (한 그룹씩 검증 후)
- [ ] `display_order` deprecated 주석 추가 (삭제는 레이아웃 안정 후 별도 PR)
- [ ] `col_span`·`row_span` deprecated 주석 추가 (폴백용으로 1~2 릴리스 유지)
- [ ] change-safety 7항 전체 회귀 체크:
  - [ ] 로그인/가입/콜백 동일
  - [ ] 멤버 SELECT만, 오너 INSERT·UPDATE
  - [ ] 신규 그룹 seed — `layout_*` 포함 확인
  - [ ] 복구 버튼 → `WIDGET_SIZE_PRESETS` 기준
  - [ ] 겹침 저장 시 UI 거부
  - [ ] tsc + lint 통과
  - [ ] 수동: portrait/landscape, 7위젯 on/off, magnify, reset per-widget & reset-all
- [ ] `README_widgets_layout.md` 1페이지 작성

---

## 5. 승인 요청 사항

Phase 1 시작 전 아래 항목 확인 및 승인 요청:

| # | 항목 | 선택지 |
|---|------|--------|
| A | DnD 라이브러리 | **@dnd-kit** ✓ / react-grid-layout / 기타 |
| B | CSS 렌더 방식 | **B안 (기존 repeat(N,1fr) 유지)** ✓ / A안 (12열 고정) |
| C | 기본 size 배정 | chat/album=L, 나머지=M ✓ / 다른 조합 |
| D | Realtime | **현행 유지** ✓ / Phase 3 이후 추가 |
| E | 모바일 편집기 | **터치 기기 = 안내만, 복구·ON/OFF는 동작** ✓ / 완전 비활성 |
| F | 백필 타이밍 | Phase 1 즉시 / Phase 6에서 일괄 |

---

## 6. 금지 사항 (전 Phase 공통)

- `supabase.auth.signUp/signIn/signOut` 흐름 변경
- `/auth/callback` 처리 로직 변경
- RLS 정책 추가·삭제·수정
- `WIDGET_SIZE_PRESETS`, `applySizePreset`, `parseWidgetSize` 삭제
- `getDashboardColumnCount`, `usesLandscapeWidgetGridLayout`, `getLandscapeColumnCountForWidgets` 중복 재구현
- `app/dashboard/page.tsx` 인라인 스타일 2개 초과 (Phase 2 시 allowlist 확인 필수)
- 커밋은 사용자 요청 시만
