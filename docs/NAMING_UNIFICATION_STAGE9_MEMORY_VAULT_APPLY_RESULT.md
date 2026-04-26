# Naming Unification - Stage 9 Memory Vault Apply Result

실행 시각: 2026-04-26

## 수행 내용

- `memory_vault -> family_album_items` 3차(마지막) 배치 SQL 적용
- 적용 도구: `user-supabase.apply_migration`

## 확인 결과 (post-check)

- 테이블/뷰 상태
  - `family_album_items` 테이블 존재
  - `memory_vault`는 호환 뷰로 존재
- 정책 상태
  - 정책은 `family_album_items` 테이블에 유지됨
  - 정책 이름은 기존 문자열(`memory_vault ...`) 유지 (동작상 문제 없음)
- realtime publication
  - `supabase_realtime`에 `family_album_items` 포함
  - `memory_vault`는 publication 대상 아님

## 코드 반영

- `lib/db-table-names.ts`
  - `DB_TABLES.FAMILY_ALBUM_ITEMS` 값을 `family_album_items`로 전환

## 비고

- 3개 rename 배치 모두 완료:
  - `feature_attachments -> attachments`
  - `family_messages -> family_chat_messages`
  - `memory_vault -> family_album_items`
- 호환 뷰를 유지하므로 즉시 롤백/호환 운영 여지가 남아 있음

