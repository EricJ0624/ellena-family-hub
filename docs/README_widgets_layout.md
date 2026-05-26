# 위젯 레이아웃 시스템

> Phase 1–6 구현 완료 기준 문서 · 2026-05-26

---

## 1. 개요

대시보드 위젯의 크기·순서를 **드래그·리사이즈**로 자유롭게 조정하고,  
너무 작아진 위젯은 **돋보기(팝업) 모드**로 전체 기능을 사용할 수 있는 시스템.

---

## 2. 아키텍처 요약

```
DB (Supabase)           앱 레이어                  렌더
─────────────           ─────────────              ──────────────────────
widget_configs          WidgetConfigDraft           app/dashboard/page.tsx
  layout_x (numeric)  ←  layoutX (number|null)  →  resolveWidgetGridPlacement()
  layout_y            ←  layoutY                →  gridColumn / gridRow CSS
  layout_w            ←  layoutW                →  colSpan
  layout_h            ←  layoutH                →  rowSpan
  layout_version          layoutVersion

  col_span [deprecated]   colSpan [deprecated]   → 폴백: resolveWidgetGridSpans()
  row_span [deprecated]   rowSpan [deprecated]
  display_order [deprecated]
```

---

## 3. 핵심 파일

| 파일 | 역할 |
|------|------|
| `lib/widgets/types.ts` | `WidgetConfigDraft`, `WIDGET_LAYOUT_PRESETS`, `WIDGET_DEFAULT_SIZE` |
| `lib/widgets/grid.ts` | `resolveWidgetGridPlacement()` — 12열 → actualCols 변환 |
| `lib/widgets/layout-presets.ts` | `packLayoutsFromOrder()`, `applyPresetToWidget()`, `resetAllLayouts()` |
| `lib/widgets/layout-constants.ts` | `USABILITY_MIN_W_PX = 160`, `USABILITY_MIN_H_PX = 120` |
| `lib/widgets/layout-migrate.ts` | `migrateAllLayouts()`, `buildBackfillSql()` — DB 백필용 |
| `lib/widgets/widget-configs.ts` | Supabase 로드/저장 (`layout_*` 포함) |
| `app/components/group-admin/WidgetLayoutEditor.tsx` | DnD + 리사이즈 편집기 (그룹 관리 화면) |
| `app/components/dashboard/WidgetChrome.tsx` | 컨테이너 쿼리 래퍼 + 🔍 버튼 |
| `app/components/dashboard/WidgetMagnifyModal.tsx` | 돋보기 팝업 다이얼로그 |

---

## 4. 좌표계

- **기준**: `BASE_COLS = 12` (12열 정규화)
- **렌더 변환**: `actualColSpan = clamp(round(layoutW × actualCols / 12), 1, actualCols)`
- **소수 허용**: `layoutW = 4.5` → 2열 그리드에서 1칸, 4열 그리드에서 2칸 (정수 snap)
- **DB 타입**: `numeric(6, 3)` nullable

### 기본 크기 프리셋 (M = 기본)

| Size | layout_w | layout_h | 4열 colSpan |
|------|----------|----------|-------------|
| S    | 4        | 2        | 1           |
| **M**| **6**    | **3**    | **2**       |
| L    | 8        | 4        | 3           |
| XL   | 12       | 6        | 4           |

---

## 5. 그룹 관리 — 레이아웃 편집 흐름

```
[편집 시작] 클릭
  → WidgetLayoutEditor 활성화
  → 드래그: display_order 재정렬 + packLayoutsFromOrder() 재패킹
  → 리사이즈: 오른쪽/아래 핸들 드래그 → layoutW/H 변경
  → ↩ (위젯별 복구): applyPresetToWidget(draft) → 기본 M 사이즈로 복구
  → 전체 복구: resetAllLayouts(drafts) → 모든 위젯 M 사이즈 + 재패킹
  → [저장]: saveWidgetConfigs() → layout_* DB 반영
```

---

## 6. 돋보기(팝업) 모드 흐름

```
WidgetChrome (ResizeObserver)
  → 실측 width < 160px || height < 120px
  → 🔍 버튼 표시

🔍 클릭
  → expandedWidget = widget_key
  → 그리드 셀 = 플레이스홀더 (이중 렌더링·구독 중복 방지)
  → WidgetMagnifyModal 열림 (framer-motion 슬라이드 업)
  → 모달 내에서 위젯 전체 기능 사용

ESC / X / backdrop 클릭
  → expandedWidget = null
  → 그리드 위젯 복원
```

---

## 7. Deprecated 예정 필드

| 필드 | 대체 | 제거 시점 |
|------|------|-----------|
| `display_order` | `layoutX / layoutY` | 레이아웃 안정 후 별도 PR |
| `col_span` | `layout_w` | 위 동일 |
| `row_span` | `layout_h` | 위 동일 |

현재 `layout_* = null`인 행의 **폴백** 및 **복구 기준**으로 유지 중.

---

## 8. DB 마이그레이션

| 마이그레이션 | 내용 |
|-------------|------|
| `widget_configs_layout_v2` | `layout_x/y/w/h numeric(6,3)` + CHECK 제약 5개 추가 |
| `widget_configs_seed_trigger_v2` | 신규 그룹 시드 시 `layout_*` 기본값(M 사이즈) 포함 |

**백필 완료** (2026-05-26): 기존 그룹 1개 × 7위젯 — S 프리셋 기준 패킹 적용.

신규 백필이 필요한 경우 `lib/widgets/layout-migrate.ts`의 `migrateAllLayouts()` 사용.

---

## 9. 인라인 스타일 allowlist

| 파일 | 허용 수 | 용도 |
|------|---------|------|
| `app/dashboard/page.tsx` | 2 | CSS Grid `gridColumn`/`gridTemplateColumns` |
| `app/components/group-admin/WidgetLayoutEditor.tsx` | 2 | DnD transform + grid columns |

---

## 10. 금지 사항 (전 Phase 공통)

- `supabase.auth.signUp/signIn/signOut` 흐름 변경 금지
- RLS 정책 추가·삭제·수정 금지
- `WIDGET_SIZE_PRESETS`, `applySizePreset`, `parseWidgetSize` 삭제 금지
- `WidgetMagnifyModal` 내에서 독립 Supabase 구독 추가 금지
