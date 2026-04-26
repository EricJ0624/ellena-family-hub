# Naming Unification - Stage 8 Family Messages Apply Result

실행 시각: 2026-04-26

## 수행 내용

- `family_messages -> family_chat_messages` 2차 배치 SQL 적용
- 적용 도구: `user-supabase.apply_migration`

## 확인 결과 (post-check)

- 테이블/뷰 상태
  - `family_chat_messages` 테이블 존재
  - `family_messages`는 호환 뷰로 존재
- 정책 상태
  - 정책은 `family_chat_messages` 테이블에 유지됨
  - 정책 이름은 기존 이름(`family_messages ...`)을 유지 (동작상 문제 없음)
- realtime publication
  - `supabase_realtime`에 `family_chat_messages` 포함
  - `family_messages`는 publication 대상 아님

## 코드 반영

- `lib/db-table-names.ts`
  - `DB_TABLES.FAMILY_MESSAGES` 값을 `family_chat_messages`로 전환

## 비고

- 앱 코드는 신규 테이블(`family_chat_messages`)을 직접 사용 가능
- 다음 배치 후보: `memory_vault -> family_album_items` (고위험, 마지막)

