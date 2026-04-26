# Naming Unification - Stage 3 Impact Analysis

목적: `memory_vault`, `feature_attachments`, `family_messages` 명칭 전환 시 연쇄 영향(RLS/FK/API/클라이언트)을 실제 스키마 기준으로 확정한다.

연계 문서:
- `docs/NAMING_UNIFICATION_STAGE1_GATE.md`
- `docs/NAMING_UNIFICATION_STAGE2_CANONICAL_DICTIONARY.md`

## 1) 이번 단계 실행 범위

- 변경 유형: 분석 전용(read-only)
- 변경 금지 준수:
  - 인증/가입/세션/권한 로직 변경 없음
  - SQL 마이그레이션 적용 없음
  - API/클라이언트 코드 변경 없음

## 2) MCP 점검 결과 요약

사용 MCP:
- `user-supabase.list_tables` (verbose=true)
- `user-supabase.execute_sql` (RLS/FK/뷰/함수/트리거 참조 분석)

핵심 결과:
- 대상 3개 테이블 모두 RLS 활성화
  - `public.memory_vault`
  - `public.feature_attachments`
  - `public.family_messages`
- RLS 정책이 `memberships`, `groups`, `auth.uid()` 조건과 강하게 결합됨
- FK 연결 존재:
  - `memory_vault.group_id -> groups.id`
  - `memory_vault.uploader_id -> profiles.id`
  - `feature_attachments.group_id -> groups.id`
  - `family_messages.group_id -> groups.id`
  - `family_messages.sender_id -> profiles.id`
- `public` 스키마 기준으로 대상 3개 테이블명을 직접 참조하는 뷰/함수/트리거는 미검출
  - 단, 정책 본문과 앱 코드 참조는 다수 존재

## 3) 코드 영향 범위 (현재 참조 현황)

### 3.1 `memory_vault`
- 참조 파일 다수 (API + 컨텍스트 + 대시보드 + 관리자)
- 대표 위치:
  - `app/api/upload/route.ts`
  - `app/api/complete-upload/route.ts`
  - `app/api/photo/download/route.ts`
  - `app/api/photos/delete/route.ts`
  - `app/api/account/delete/route.ts`
  - `app/api/groups/delete/route.ts`
  - `app/contexts/AlbumContext.tsx`
  - `app/dashboard/page.tsx`
  - `app/components/group-admin/GroupAdminPanel.tsx`

판정: **고위험**

### 3.2 `feature_attachments`
- 참조 파일 제한적
  - `app/api/attachments/route.ts`
  - `app/api/attachments/complete/route.ts`

판정: **중위험**

### 3.3 `family_messages`
- 참조가 family-chat 훅에 집중
  - `app/features/family-chat/hooks/useFamilyChatActions.ts`
  - `app/features/family-chat/hooks/useFamilyChatInitialLoad.ts`

판정: **중위험**

## 4) 안정성 리스크 판정

## 4.1 즉시 물리 rename 리스크

- 테이블 rename 자체보다 위험한 지점:
  - RLS 정책 본문과 권한 분기
  - API/클라이언트의 하드코딩 테이블 문자열
  - 업로드/삭제 플로우 연쇄(특히 album)

결론:
- `memory_vault`는 즉시 rename 금지
- `feature_attachments`, `family_messages`도 코드 전환/검증 없이 즉시 rename 금지

## 4.2 권장 전환 순서

1. 코드 상수화(논리명/물리명 분리)
2. 저위험 배치부터 코드 참조 전환
3. 핵심 시나리오 회귀 검증
4. 필요 시 호환 레이어(뷰) 도입
5. 최종 물리 rename 여부 결정

## 5) Stage 4 입력값 (마이그레이션+코드 동시 반영 준비)

고정 대상 논리명:
- `memory_vault` -> `family_album_items` (논리명 우선, 물리명 보류)
- `feature_attachments` -> `attachments`
- `family_messages` -> `family_chat_messages`

Stage 4 착수 조건:
1. 배치 단위(2~4파일) 확정
2. 각 배치별 롤백 방법 확정
3. 인증/가입/권한 회귀 체크리스트 사전 고정

## 6) 승인 요청 포인트

아래 항목은 실제 수정 전에 사용자 승인 필요:
- DB 스키마 변경(테이블 rename/뷰 생성 포함)
- RLS 정책 변경
- 사용자 체감 동작 변경 가능성이 있는 API 수정

