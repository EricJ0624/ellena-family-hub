# Naming Unification - Stage 6 Attachments Dry-Run Runbook

목적: `feature_attachments -> attachments` 전환을 dev/staging에서 안전하게 검증하는 실행 순서를 고정한다.

주의:
- 이 문서는 **드라이런 절차**다.
- 운영 DB에 바로 적용하지 않는다.

연계 파일:
- `supabase_rename_feature_attachments_to_attachments_plan.sql`
- `supabase_naming_unification_postcheck.sql`
- `docs/NAMING_UNIFICATION_STAGE5_SQL_EXECUTION_CHECKLIST.md`

## 1) 시작 전 선언 (변경 안전성 게이트)

- 작업 유형: DB 스키마 변경 포함(고위험)
- 영향 범위:
  - DB: `feature_attachments` 관련 테이블/정책/realtime publication
  - 앱: 첨부 API, 채팅 첨부 Realtime
- 변경 금지:
  - 인증/가입/세션 로직
  - 권한 모델 변경(정책 로직 자체 변경)

## 2) MCP 기준 사전 점검 순서

1. `list_tables(verbose=true)` 호출
2. 대상 테이블 존재 확인
   - `public.feature_attachments` 존재
   - `public.attachments` 미존재
3. `execute_sql`로 정책 스냅샷 확보
   - `pg_policies`에서 `feature_attachments` 정책 확인
4. `execute_sql`로 FK 스냅샷 확보
   - `information_schema` 기반 FK 확인

## 3) 드라이런 적용 순서 (dev/staging)

1. SQL 편집기에서 `supabase_rename_feature_attachments_to_attachments_plan.sql` 실행
2. 즉시 `supabase_naming_unification_postcheck.sql` 실행
3. 결과 확인:
   - `attachments` 존재
   - `feature_attachments`는 호환 뷰로 조회 가능
   - 정책이 `attachments`에 존재
   - realtime publication에 `attachments`가 포함됨

## 4) 기능 검증 (필수)

1. 첨부 업로드
   - 채팅 첨부 업로드 성공
   - 여행 첨부 업로드 성공
2. 첨부 조회
   - `/api/attachments` GET 정상
   - `/api/attachments` POST(일괄 조회) 정상
   - `/api/attachments/complete` POST 정상
3. 첨부 삭제 권한
   - 업로더/ADMIN/OWNER 삭제 가능
   - 일반 멤버 타인 첨부 삭제 불가
4. Realtime
   - 채팅 첨부가 실시간 반영됨

## 5) 실패 기준

아래 중 하나라도 발생하면 실패:
- 첨부 업로드/조회/삭제 중 1개 실패
- Realtime 첨부 반영 실패
- 권한 판정 이상(삭제 권한 누수/과차단)
- post-check에서 정책/테이블 상태 이상

## 6) 실패 시 즉시 롤백

1. 동일 SQL 파일 하단 rollback 블록 실행
2. `supabase_naming_unification_postcheck.sql` 재실행
3. 기능 재검증(업로드/조회/삭제/Realtime)
4. 원인 분석 전 재시도 금지

## 7) 성공 시 다음 단계 진입 조건

아래 모두 충족 시에만 2번 배치(`family_messages`)로 이동:
- post-check 이상 없음
- 첨부 관련 핵심 시나리오 모두 통과
- 에러 로그 급증 없음

