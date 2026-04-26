# Naming Unification - Stage 6 Precheck Snapshot

수집 시각: 2026-04-26
수집 방법: `user-supabase` MCP (`list_tables`, `execute_sql`)

목적: `feature_attachments -> attachments` 드라이런 적용 전 상태를 고정한다.

## 1) 대상 테이블 존재 상태

검증 쿼리:
- `information_schema.tables`에서 `feature_attachments`, `attachments` 조회

결과:
- `feature_attachments`: 존재
- `attachments`: 미존재

판정:
- rename 사전 조건 충족

## 2) RLS/정책 스냅샷 (`feature_attachments`)

검증 쿼리:
- `pg_policies`에서 `tablename='feature_attachments'`

결과 정책:
- `feature_attachments_select_member` (`SELECT`)
- `feature_attachments_insert_member` (`INSERT`)
- `feature_attachments_delete_owner_or_admin` (`DELETE`)

판정:
- 정책 3개 활성 상태 확인

## 3) FK 스냅샷 (`feature_attachments`)

검증 쿼리:
- `information_schema.table_constraints` + `key_column_usage` + `constraint_column_usage`

결과:
- `feature_attachments_group_id_fkey`
  - `feature_attachments.group_id -> groups.id`

판정:
- 핵심 FK 확인 완료

## 4) 테이블 목록 참고 정보

`list_tables` 결과상 `public.feature_attachments`:
- RLS enabled: `true`
- Rows: `3`

## 5) 다음 단계 진입 판단

아래 조건 모두 충족:
1. old 이름 존재 / new 이름 미존재
2. 정책 스냅샷 확보
3. FK 스냅샷 확보

=> `attachments` 드라이런 SQL 적용 단계로 진행 가능

