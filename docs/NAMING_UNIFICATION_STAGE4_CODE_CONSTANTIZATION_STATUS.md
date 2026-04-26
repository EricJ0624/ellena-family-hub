# Naming Unification - Stage 4 Code Constantization Status

기준 시점: 2026-04-26

## 완료 범위

- `DB_TABLES` 상수 도입 완료
  - 파일: `lib/db-table-names.ts`
- 앱 코드(`ts/tsx`)에서 아래 하드코딩 쿼리 참조 제거 완료
  - `from('memory_vault')`
  - `from('feature_attachments')`
  - `from('family_messages')`
  - `table: 'memory_vault'`
  - `table: 'feature_attachments'`
  - `table: 'family_messages'`

## 확인 결과

- 코드 전수 검색 기준(앱 ts/tsx):
  - `memory_vault` 직접 테이블 참조: 0건
  - `feature_attachments` 직접 테이블 참조: 0건
  - `family_messages` 직접 테이블 참조: 0건

## 안전성 관점 요약

- 이번 단계는 **참조 상수화만** 수행
- 인증/가입/권한 로직 미변경
- DB 스키마/RLS/정책 미변경 (SQL 초안만 작성, 미실행)

## 다음 단계

1. SQL 초안 리뷰 (3개)
   - `supabase_rename_feature_attachments_to_attachments_plan.sql`
   - `supabase_rename_family_messages_to_family_chat_messages_plan.sql`
   - `supabase_rename_memory_vault_to_family_album_items_plan.sql`
2. dev/staging 선적용 및 기능 회귀 확인
3. 운영 반영 여부 최종 승인

