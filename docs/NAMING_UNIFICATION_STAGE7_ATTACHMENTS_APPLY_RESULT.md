# Naming Unification - Stage 7 Attachments Apply Result

실행 시각: 2026-04-26

## 수행 내용

- `feature_attachments -> attachments` 1차 배치 SQL 적용
- 적용 도구: `user-supabase.apply_migration`
- 초기 시도 중 publication 문법 이슈를 수정한 후 재적용 성공

## 확인 결과 (post-check)

- 테이블/뷰 상태
  - `attachments` 테이블 존재
  - `feature_attachments`는 호환 뷰로 존재
- 정책 상태
  - `attachments_select_member` (SELECT)
  - `attachments_insert_member` (INSERT)
  - `attachments_delete_owner_or_admin` (DELETE)
- realtime publication
  - `supabase_realtime`에 `attachments` 포함
  - `feature_attachments`는 publication 대상 아님

## 코드 반영

- `lib/db-table-names.ts`
  - `DB_TABLES.ATTACHMENTS` 값을 `attachments`로 전환

## 비고

- 현재 앱 코드는 호환 뷰에 의존하지 않고 신규 테이블(`attachments`)을 직접 사용 가능
- 다음 배치 후보: `family_messages -> family_chat_messages`

