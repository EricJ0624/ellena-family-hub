# Hearth 멀티 앱 · 그룹 격리 구현 계획

> 상태: **Phase A·B·C-1·C-2·C-2b 완료** (B-5 보류 / Phase D 진행 중)  
> **세션:** C-2b 레거시 S3 삭제 완료. Phase D-1(RLS·create_group)은 승인 대기.

---

## 0. 확정된 제품·아키텍처 (변경 금지 전제)

| 항목 | 결정 |
|------|------|
| 제품명 | Hearth Family / Couple / Biker / Camper |
| 시스템 라벨 | `app_id`: `hearth_family` / `hearth_couple` / `hearth_biker` / `hearth_camper` |
| 도메인 | `myhearthfamily.com` / `couple.myhearthfamily.com` (예시) |
| Supabase | **프로젝트 1개** (Auth·DB 공유) |
| 계정 | **계정 1개**로 여러 앱 로그인 (비밀번호 공용) |
| 프론트 | 앱마다 **별도** 가입/로그인 UI·브랜드 (폴더 복사 후 수정) |
| 데이터 격리 | 앱 간 = `app_id` / 가족 간 = `group_id` |
| 인프라 | S3·CloudFront는 공유 가능(prefix 분리), Vercel은 앱당 프로젝트 권장 |
| 결제(나중) | 계정과 분리, **앱(상품)별** 구독 가능 |
| 앱 간 데이터 이전(나중) | 스키마 유사 전제, `app_id` 기준 export/import |
| Couple 착수 시점 | **Family 기능 완료 후**, 현재 앱 폴더 복사로 시작 |

### 비목표 (이번에 하지 않음)

- Supabase 프로젝트 분리 (Option 1) — **채택하지 않음**
- 앱마다 다른 비밀번호·완전 별도 Auth 계정
- Couple 앱 구현·폴더 복사 (Phase D 이후)
- Stripe 등 인앱 결제 구현
- 가입/로그인 **플로우·UX·라우팅 변경** (화면 복사는 Couple 때)
- 디자인 리뉴얼, 대시보드 재렌더 구조 개편

### 보존 원칙 (모든 Phase 공통)

명시 승인 없이 변경하지 않음:

- 정상 동작 중인 기능의 체감 동작
- 가입·로그인·계정·세션·`/auth/callback` 로직
- 권한 모델 결과(멤버/ADMIN/시스템 관리자+dashboard access)
- 디자인/레이아웃 구조
- RLS를 “느슨하게” 만드는 변경

허용되는 변경: **경계를 더 좁히는 가드**(그룹 미지정 시 전체 유저 조회 금지, 무인증 푸시 금지 등) — UX가 동일하도록 호출부만 맞춤.

---

## 1. 단계 총괄

| Phase | 이름 | 시점 | 승인 | 결과 |
|-------|------|------|------|------|
| **A** | 가족(그룹) 격리 Critical | **지금** | 필수 | 크로스 그룹 디렉터리/푸시 구멍 제거 |
| **B** | 그룹 격리 Medium (선택·후속) | A 안정화 후 | 필수 | Realtime 필터, photo proxy, RLS 문구 |
| **C** | `app_id` 심기 (Family 고정) | Family 기능 거의 완료 후, Couple 직전 권장 | 필수 | **C-1 완료:** `groups.app_id` + 가드 + S3 신규 prefix. C-2(배치·광범위 RLS) 후속 |
| **D** | Hearth Couple 스캐폴드 | Family 완료 후 | 필수 | 폴더 복사 + 새 Vercel + 같은 Supabase + `hearth_couple` |
| **E** | 결제·앱 간 이전 | 훨씬 이후 | 필수 | 상품별 결제, 데이터 이전 도구 |

**원칙:** A → (B) → C → D 순서. C를 A와 동시에 하지 않는다.  
**실수 방지:** 한 Phase = 파일 2~4개 단위 PR 또는 화면/API 단위로 분할.

---

## 2. Phase A — 그룹 격리 Critical (지금)

### 2.1 작업 유형 선언

- **유형:** 보안 가드 강화 (로직/연동 영향 **있음** → 사전 승인 필수)
- **영향 범위:** API 가드 + 대시보드 호출부 소수
- **변경 금지:** 인증 가입/로그인/세션/라우팅/RLS 정책 대수술, UI 디자인

### 2.2 목표

가족 A가 가족 B 멤버 목록을 받거나, 인증 없이 임의 유저에게 푸시하지 못하게 한다.  
사용자 체감: 위치 요청·닉네임·멤버 목록은 **우리 그룹만** 보이며, 로그인/가입은 동일.

### 2.3 작업 목록 (실수 없이)

#### A-1. `/api/users/list` — `groupId` 필수화

**파일**

- `app/api/users/list/route.ts`
- 호출부: `app/dashboard/page.tsx` (`loadAllUsers`)

**변경**

1. `groupId` 없으면 **400** (전체 profiles/`listUsers` 경로 제거 또는 도달 불가).
2. `requireGroupMember(user.id, groupId)` **항상** 수행.
3. 응답은 해당 그룹 owner + memberships 교집합만.
4. `auth.admin.listUsers`로 전 사용자 동기화 후 전체 반환하는 분기는 **그룹 필터 없이는 금지**.  
   - 동기화가 필요하면: 그룹 멤버 id만 profiles에서 보강 (전역 sync 금지).
5. `loadAllUsers()` 무인자 호출(`page.tsx` ~6031 닉네임 저장 후 등) → **반드시 `currentGroupId` 전달**.  
   - `currentGroupId` 없으면 API 호출하지 않고 no-op 또는 기존 목록 유지.

**하지 말 것**

- `/api/admin/users/list` 동작 변경 (플랫폼 관리자용 유지)
- profiles 테이블 스키마 변경 (A에서는)

#### A-2. `/api/push/send` — 인증 + 그룹 멤버십

**파일**

- `app/api/push/send/route.ts`
- 호출부: 위치 요청 등 (`app/api/location-request` 경로 및 클라이언트)

**변경**

1. `requireAuthUser` 필수.
2. `groupId` 필수.
3. 요청자가 해당 그룹 멤버인지 검사.
4. `targetUserId`가 같은 그룹 멤버(또는 owner)인지 검사.
5. `groupId` 없이 “푸시만” 보내던 레거시 분기 **제거** (또는 내부 전용 시크릿 헤더 — 기본은 제거).

**하지 말 것**

- `notifyFamily` / preference 로직 대수술
- 푸시 문구·UX 변경

#### A-3. profiles RLS (A에서는 **보류 권장**)

`USING (true)`는 Critical 냄새이나, 즉시 조이면 닉네임 표시 회귀 위험.

- **A Phase:** API 계층(A-1)으로 디렉터리 유출 차단에 집중.
- **B 또는 C:** “같은 그룹 멤버만 SELECT” 또는 “본인 + 공유 그룹 멤버” 정책으로 축소.  
  변경 전: 클라이언트 `.from('profiles')` 직접 조회 전수 조사 필수.

### 2.4 Phase A 검증 체크리스트

- [ ] 로그인 / 로그아웃 / 가입 / 인증 메일 / `/auth/callback` — **이전과 동일**
- [ ] 대시보드 로드, 닉네임 저장 후 — 멤버 목록이 **현재 그룹만**
- [ ] `groupId` 없이 `/api/users/list` → 400
- [ ] 다른 그룹 id로 목록 요청 → 403
- [ ] 위치 요청 / 일루와 — 같은 그룹 대상만 푸시, 성공 시 기존과 동일 UX
- [ ] 비로그인으로 `/api/push/send` → 401
- [ ] 타 그룹 `targetUserId` → 403
- [ ] 시스템 관리자 + 승인된 dashboard access — 기존 관리 기능 회귀 없음
- [ ] `tsc` / lint (관련 파일)
- [ ] 디자인·레이아웃 변화 없음

### 2.5 Phase A 롤백

- API를 `groupId` 선택적으로 되돌리고, 호출부 원복.
- 마이그레이션 없음 → DB 롤백 불필요.

---

## 3. Phase B — 그룹 격리 Medium (A 이후, 선택)

각 항목 별도 승인. 가입/로그인 미포함.

| ID | 내용 | 주요 파일 | 비고 |
|----|------|-----------|------|
| B-1 | 채팅·위치 Realtime에 `group_id=eq.` 서버 필터 | `useFamilyChatRealtime.ts`, `useFamilyLocation.ts`, `dashboard/page.tsx` | 다중 그룹 멤버 교차 이벤트 방지 |
| B-2 | photo proxy/diagnose 인증·키의 그룹 소유 검증 | `app/api/photo/proxy`, `diagnose`, download | CloudFront 직링크와 병행 시 정책 명확화 |
| B-3 | `piggy_open_approvals` INSERT에 멤버십 CHECK | SQL 마이그레이션 | API 가드와 이중화 |
| B-4 | 레거시 RLS `group_id IS NULL OR` 제거 | 관련 `supabase_*.sql` → 적용 마이그레이션 | 컬럼 NOT NULL 전제 MCP로 재확인 |
| B-5 | profiles SELECT 범위 축소 | RLS + 클라이언트 조회 경로 | **회귀 테스트 최우선** |

검증: 해당 기능 시나리오 + Phase A 체크리스트 회귀.

---

## 4. Phase C — `app_id` 심기 (Couple 직전 권장)

### 4.1 작업 유형

- **유형:** 스키마 + API/스토리지 라벨 (연동·보안 영향 **있음** → 승인 필수)
- **목표:** 현재 앱 데이터를 전부 `hearth_family`로 고정해 Couple 추가·이전 준비
- **금지:** 가입/로그인 UI·플로우 변경, 디자인 변경

### 4.2 스키마 설계 (실수 방지 규칙)

1. **상수**
   - `lib/apps.ts` (또는 유사):  
     `export const APP_IDS = { FAMILY: 'hearth_family', COUPLE: 'hearth_couple' } as const`  
     `export const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID ?? 'hearth_family'`

2. **어디에 `app_id`를 붙이는가**

| 대상 | 방법 | 이유 |
|------|------|------|
| `groups` | `app_id NOT NULL DEFAULT 'hearth_family'` | 테넌트(가족)의 앱 소속 |
| 그룹에 종속된 테이블 (`family_*`, travel, piggy, attachments, notifications, location_*, widget_configs, …) | **(권장) groups 경유** 또는 **컬럼 중복** | 중복 시 쿼리 단순, 경유만이면 JOIN 필수 |
| `memberships` | group 경유로 충분 (또는 동일 app_id 복사) | |
| `profiles` | **앱 전용 행 분리하지 않음** (계정 1개) | Option 2 |
| 플랫폼 전역 | `announcements`, `system_*`, `place_cache` | `app_id` 없거나 `null` = 플랫폼 |

**권장 실무:**  
- `groups.app_id` 필수  
- 자주 쿼리하는 대형 테이블에도 `app_id` 복제 + RLS에 `app_id = current_setting` 또는 멤버십∩앱 검사  
- 기존 행 백필: `UPDATE ... SET app_id = 'hearth_family'`

3. **앱 컨텍스트 전달**

- 서버: `NEXT_PUBLIC_APP_ID` / `APP_ID` = `hearth_family`
- API 가드: `requireGroupMember` 이후 그룹의 `app_id === CURRENT_APP_ID` 검증 추가 (타 앱 그룹 id 추측 방지)
- 클라이언트: env만 사용, 하드코딩 최소화

4. **S3**

- `generateS3KeyWithGroup` →  
  `originals/apps/{appId}/groups/{groupId}/...`
- **기존 키 마이그레이션:**  
  - Phase C-1: **신규 업로드만** 새 prefix  
  - Phase C-2(선택): 배치로 기존 객체 복사/이동 + DB URL 갱신  
  - 실수 방지: C-1만으로 Couple 출시 가능, 이전 키도 Family 앱에서 계속 읽기 허용

5. **가입/로그인**

- **플로우 코드 변경 없음**
- (선택, 최소) `profiles` 또는 `user_app_grants`에 “이 앱을 쓴 적 있음”만 기록 — **비밀번호·signUp 호출 횟수·콜백 불변**
- Couple 첫 방문 시 같은 계정 로그인만으로 진입 (온보딩은 Couple Phase)

### 4.3 RLS / 가드

- 그룹 SELECT: 멤버십 AND `groups.app_id = 'hearth_family'` (Family 배포)
- service role API는 `app_id` 필터를 코드에서 강제
- 시스템 관리자 교차 그룹 접근(`dashboard_access_requests`)은 **동일 app 내**로 제한할지 명시 결정 후 반영 (기본: 기존 동작 유지 + app_id 일치)

### 4.4 Phase C 검증

#### C-1 (완료)
- [x] `groups.app_id` + 기존 행 `hearth_family` 백필
- [x] `create_group` 신규 그룹 `app_id=hearth_family`
- [x] `lib/apps.ts` (`CURRENT_APP_ID`)
- [x] `requireGroupMember` / `requireGroupAdmin` 앱 일치 가드
- [x] 신규 S3 키 `originals/apps/hearth_family/` (기존 키 읽기 유지)

#### 수동 회귀 (배포 후)
- [ ] 기존 가족 데이터 조회·작성 정상
- [ ] 로그인·가입·초대·권한 불변
- [ ] 신규 업로드 키에 `apps/hearth_family/` 포함
- [ ] 기존 사진/영상 표시 정상

#### C-2 (완료, S3 배치는 C-2b)
- [x] `groups` RESTRICTIVE RLS (`app_id=hearth_family`)
- [x] `group_id` 테이블 RESTRICTIVE 앱 필터 (기존 정책 유지)
- [x] 핵심 테이블 `app_id` 복제·백필·INSERT 트리거
- [x] C-1 API 가드로 타 앱 `group_id` 거부 (E2E는 수동)
- [x] C-2 hotfix: RLS 재귀 제거 (`supabase_phase_c2_fix_rls_recursion.sql` — denormalized `app_id` / `is_hearth_family_group`)
- [x] C-2b: S3 레거시 키 배치 이전 (`scripts/phase-c2b-migrate-s3-keys.mjs` — 레거시 삭제는 검증 후 선택)

### 4.5 롤백

- 컬럼은 DEFAULT로 남겨두고 가드만 되돌리기 가능
- S3는 신규 prefix만이면 롤백 시 새 업로드 경로만 원복

---

## 5. Phase D — Hearth Couple (Family 완료 후)

### 5.1 절차

1. 현재 레포/폴더 복사 → `hearth-couple` (이름 확정)
2. Vercel 프로젝트 **신규** + 도메인 `couple.myhearthfamily.com`
3. **같은** Supabase URL/키 (Option 2)
4. env: `NEXT_PUBLIC_APP_ID=hearth_couple`
5. 브랜드·카피·아이콘만 Couple로 교체 (가입/로그인 **화면은 별도**, Auth API는 동일)
6. 불필요 Family 전용 기능 제거·수정 (스키마 달라도 OK이나, **이전 가능성을 열려면** 공통 테이블 관례 유지)
7. 온보딩: 기존 계정 로그인 → 커플 스페이스(그룹) 생성 (`app_id=hearth_couple`)

### 5.2 실수 방지

- Family Vercel env를 Couple에 덮어쓰지 말 것
- Redirect URL을 Supabase Auth에 **Couple 도메인 추가** (가입/로그인 로직 코드는 그대로, **대시보드 설정만** 추가)
- RLS가 `app_id`를 보면 Family 세션으로 Couple 데이터가 안 보임 — 반대도 동일
- S3 prefix `apps/hearth_couple/`

### 5.3 검증

- [ ] 같은 이메일/비번으로 Couple 로그인
- [ ] Family 데이터가 Couple UI에 안 보임 (반대도)
- [ ] Couple에서 새 그룹·기능 동작
- [ ] Family 기존 사용자·기능 회귀 없음
- [ ] Auth Redirect 양 도메인 동작

---

## 6. Phase E — 이후 (계획만)

### 6.1 결제

- Stripe(또는 유사) 상품: `hearth_family_*`, `hearth_couple_*`
- DB: `user_id` + `app_id` + subscription status
- 번들은 별도 상품 (원치 않으면 생략)

### 6.2 앱 간 데이터 이전

- 전제: 유사 스키마, 모든 이전 대상 행에 `app_id`·`group_id` 명확
- 도구: 선택 그룹을 타 `app_id`로 복사/이동 + 멤버십 재매핑 + S3 객체 copy
- **비밀번호/계정 이전 불필요** (이미 동일 계정)

---

## 7. 인프라 체크리스트 (Couple 시점)

| 서비스 | Family | Couple |
|--------|--------|--------|
| Supabase | 기존 1 | **동일** |
| Vercel | 기존 | **신규 권장** |
| S3 | 공유 + `apps/hearth_family/` | 공유 + `apps/hearth_couple/` |
| CloudFront | 공유 가능 | path/도메인 규칙 추가 또는 배포 추가 |
| Auth Redirect URLs | 기존 | Couple URL **추가** |

---

## 8. PR / 승인 분할 권장

1. **PR-A1:** `users/list` groupId 필수 + dashboard 호출 수정  
2. **PR-A2:** `push/send` 인증·멤버십  
3. **PR-B\*(선택):** Realtime / photo / RLS  
4. **PR-C1:** `groups.app_id` + 백필 + env + 가드  
5. **PR-C2:** S3 prefix 신규 업로드  
6. **PR-D:** Couple 스캐폴드 (별도 레포/폴더)

한 PR에 A+C+D 금지.

---

## 9. 지금 당장 할 일 (승인 요청용 요약)

### 세션 핸드오프 (다음에 이어서)

| 항목 | 상태 |
|------|------|
| A·B·C-1·C-2 | 완료 |
| C-2 RLS 재귀 핫픽스 | 완료 — 그룹/채팅/앨범 로드 확인됨 |
| C-2b S3 레거시 키 이전 | 완료 (43 Copy + DB 갱신). 레거시 S3 삭제는 검증 후 선택 |
| B-5 profiles RLS | 보류 |
| Phase D Couple | 미착수 — Family 완료·승인 후 |

**다음 착수 후보 (승인 후):**

1. **Phase D** — Hearth Couple 스캐폴드 (폴더 복사 + 새 Vercel + 같은 Supabase + `hearth_couple`)
2. (선택) C-2b 레거시 S3 객체 삭제 — 앨범/첨부 표시 검증 후

**유지:** 가입/로그인/계정/디자인/권한 모델·정상 기능 체감 동작.

---

## 10. 결정 로그 (요약)

- Option **2** (단일 Supabase, 계정 1, `app_id` 데이터 분리)
- 앱마다 가입/로그인 **프론트 분리**, Auth 백엔드 공유
- 그룹 Critical **먼저**, `app_id`는 Couple 전
- 결제·이전은 나중
- 가입/로그인 로직·디자인·정상 기능 보존

---

*문서 끝. 구현은 Phase별 사용자 승인 후 시작.*
