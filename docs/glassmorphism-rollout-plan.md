# Glassmorphism 롤아웃 계획

이 문서는 UI/표현 계층 위주로 글래스모피즘을 단계 적용하기 위한 체크리스트다.  
**구현 시 반드시** 워크스페이스 규칙 [`.cursor/rules/change-safety-and-approval.mdc`](../.cursor/rules/change-safety-and-approval.mdc)를 따른다.

---

## 규칙 준수 요약 (매 단계 시작 전)

1. **작업 유형**: 기본값은 **스타일-only** (Tailwind / `globals.css` / 클래스명). 로직·권한·API·RLS·라우팅·인증 흐름 변경이 섞이면 별도 선언 후 **사용자 승인** 후 진행.
2. **영향 범위**: 해당 단계의 파일 목록만 수정. **금지 영역** — 인증/가입/세션、`/auth/callback`、초대코드、API route 동작 변경、RLS/SQL、권한 판정 — 는 건드리지 않는다.
3. **분할**: 파일 **2~4개** 또는 **화면 1개** 단위 PR 권장.
4. **검증**: 단계마다 최소 `pnpm exec tsc --noEmit`(또는 프로젝트 표준), lint, 해당 화면 수동 스모크.

---

## Phase 0 — 기준·토큰 고정

**목표**: “배경 / 유리 패널 / 내부 솔리드(폼·경고)” 역할과 블러 겹침 상한을 팀(본인) 기준으로 문서화.

| 항목 | 메모 |
|------|------|
| 블러 단계 | 예: 약 / 중 / 강 2~3단계만 |
| 불투명도 | 라이트·다크 각각 |
| 성능 | 모바일 기준 `backdrop-filter` 겹침 상한(예: 화면당 1~2겹) |

### Phase 0 산출물 (v1 기준값)

#### 0-1) 레이어 역할 정의

- **배경 레이어**: 페이지/앱 셸의 그라데이션 또는 은은한 패턴. 콘텐츠 가독성을 해치지 않도록 채도는 낮게 유지.
- **유리 패널 레이어**: 섹션/모달 외곽 카드. 반투명 + 블러 + 얇은 보더로 깊이 표현.
- **내부 솔리드 레이어**: 입력폼, 데이터 밀집 리스트, 경고 박스. `bg-white` 또는 다크 솔리드 유지 허용.

#### 0-2) 글래스 강도 프리셋

| 프리셋 | 배경(라이트) | 배경(다크) | 블러 | 보더 | 그림자 |
|--------|--------------|------------|------|------|--------|
| Glass-Soft | `rgba(255,255,255,0.72)` | `rgba(30,41,59,0.62)` | `blur(8px)` | `1px solid rgba(255,255,255,0.35)` | `0 4px 12px rgba(15,23,42,0.10)` |
| Glass-Medium (기본) | `rgba(255,255,255,0.80)` | `rgba(30,41,59,0.70)` | `blur(12px)` | `1px solid rgba(255,255,255,0.45)` | `0 8px 24px rgba(15,23,42,0.14)` |
| Glass-Strong (모달 전용) | `rgba(255,255,255,0.88)` | `rgba(30,41,59,0.78)` | `blur(16px)` | `1px solid rgba(255,255,255,0.55)` | `0 16px 36px rgba(15,23,42,0.18)` |

#### 0-3) 성능/적용 상한

- 모바일(특히 iOS Safari) 기준 **동시 블러 레이어 2개 이하** 유지.
- 한 화면에서 Glass-Strong은 **모달/팝오버 1개** 용도로 제한.
- 스크롤 컨테이너 내부 중첩 블러는 피하고, 가능하면 상위 래퍼 1곳에만 적용.

#### 0-4) 예외 원칙

- `FamilyTasksSection`의 `chalkboard-container`는 Phase 3 이전에는 **디자인 예외**로 유지.
- 관리자 화면(`admin`, `group-admin`)은 가독성 우선으로 기본은 솔리드 유지, 헤더/패널부터 점진 적용.

#### 0-5) 완료 조건 (DoD)

- 이 문서에 레이어/프리셋/성능 상한이 명시되어 있고 다음 단계에서 참조 가능.
- 다음 단계(Phase 1)에서 사용할 기본 프리셋이 **Glass-Medium**으로 합의됨.

**터치 파일**: 이 문서만, 또는 토큰 주석을 `app/globals.css`에 추가(스타일-only).

---

## Phase 1 — 공통 프리셋

**목표**: `@layer components` 등에 `.glass-panel` 또는 기존 `.content-section`과 통합할 단일 프리셋 정의.

| 금지 | 인증·데이터 fetch·상태 머신 변경 |
| 예상 파일 | `app/globals.css`, (선택) `tailwind.config.mjs` |
| 검증 | 대시보드 1회 로드, 다크 토글 시 깨짐 없음 |

---

## Phase 2 — 앱 셸(`body` / `.app-container`)

**목표**: 배경 레이어 일관성(단색 `body` vs 그라데이션 셸). 데스크톱 폰 프레임과 조화.

| 예상 파일 | `app/globals.css`, 필요 시 `app/layout.tsx`(스타일 클래스만) |
| 주의 | `layout.tsx`에서 인증/메타 변경 없음 |

---

## Phase 3 — 대시보드 위젯

**목표**: 위젯 외곽은 `.content-section` 토큰 정렬; 내부 `bg-white` 카드는 “솔리드 유지 vs 서브글래스” 정책에 따라 순차 적용.

| 예상 파일 (우선순위 예시) | `app/features/**/Family*Section.tsx`, `app/dashboard/page.tsx`(클래스만) |
| 예외 UI | `FamilyTasksSection` — `chalkboard-container`: 유지 / 톤만 / 교체 중 택일 명시 후 작업 |

---

## Phase 4 — 풀 페이지 (`/memories`, `/piggy-bank`, `/travel`)

**목표**: 페이지 루트에 은은한 배경층 후 패널에 Phase 1 프리셋.

| 화면 | 주요 파일 |
|------|-----------|
| Memories | `app/memories/page.tsx` (+ 필요 시 `globals.css`의 `.memories-page`) |
| Piggy | `app/piggy-bank/page.tsx` |
| Travel | `app/modules/travel-planner/TravelPlannerContent.tsx` |

---

## Phase 5 — 관리자 (`/admin`, `/group-admin`)

**목표**: 가독성 우선 — 전면 글래스보다 헤더/카드 일부만 적용 검토.

| 주요 파일 | `app/admin/page.tsx`, `app/components/group-admin/GroupAdminPanel.tsx`, `app/globals.css`(`.admin-*` / `.group-admin-*`) |

---

## Phase 6 — 모달·오버레이

**목표**: `.modal-overlay` 스타일과 Tailwind `fixed inset-0 bg-black/50` 패턴 간 블러·어둠 정도 통일.

| 주요 파일 | `app/globals.css`, 각 기능 내 모달 JSX(클래스만) |

---

## Phase 7 — 다크 모드·접근성

**목표**: `:root` / `.dark`의 `--glass-bg` 등과 보더·본문 대비 점검.

---

## Phase 8 — 실기 검증

**목표**: iOS Safari 등에서 스크롤·고정 헤더·모달·`backdrop-filter` 깨짐 여부.

**검증 로그**: `docs/glassmorphism-phase8-validation.md`

---

## 참고: 기능별 레이아웃 뼈대 (현재 코드 기준)

| 영역 | 뼈대 |
|------|------|
| 대시보드 | `.app-container` → `.main-content` → `.sections-container`; 위젯 다수 `content-section`; `md:`에서 폭 430px 폰 프레임 |
| Memories | `memories-page` 풀높이; 헤더 sticky + `mainMaxWidth` 최대 약 1200px; 그리드 동적 열 |
| Piggy / Travel | `min-h-screen bg-slate-50 p-5` 류 셸 |
| Admin / Group admin | `min-h-screen bg-[#f5f7fa] p-5`; 헤더·콘텐츠 카드형; 모바일은 `globals`에서 패딩·그리드 1열 |
| 가족 임무 | `chalkboard-container` (별도 비주얼) |

---

## 진행 상태 체크박스

- [ ] Phase 0
- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
- [ ] Phase 4
- [ ] Phase 5
- [ ] Phase 6
- [ ] Phase 7
- [ ] Phase 8

완료한 단계는 PR 머지 후 체크한다.
