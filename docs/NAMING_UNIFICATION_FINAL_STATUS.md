# Naming Unification Final Status

완료 시각: 2026-04-26

## 최종 결론

- 테이블/스키마/정책/앱 코드 참조 네이밍 통일 작업 완료
- 임시 호환 레이어(compatibility views) 제거 완료
- 운영 기준에서 신규 이름 체계로 일원화 완료

## 적용 완료된 테이블 전환

- `feature_attachments` -> `attachments`
- `family_messages` -> `family_chat_messages`
- `memory_vault` -> `family_album_items`

## 앱 코드 상태

- `lib/db-table-names.ts` 기준 신규 물리 테이블명 사용
  - `ATTACHMENTS: 'attachments'`
  - `FAMILY_MESSAGES: 'family_chat_messages'`
  - `FAMILY_ALBUM_ITEMS: 'family_album_items'`
- 앱 코드(`ts/tsx`)에서 구 이름 직접 쿼리 참조 제거 완료

## DB 정리 상태

- 호환 뷰 제거 완료
  - `public.feature_attachments` view 제거
  - `public.family_messages` view 제거
  - `public.memory_vault` view 제거
- RLS 정책명도 신규 테이블명 기준으로 정리 완료
- realtime publication 대상 테이블 정상
  - `attachments`
  - `family_chat_messages`
  - `family_album_items`

## 회귀 리스크 관점 요약

- 인증/가입/세션 로직은 변경하지 않음
- 단계별 적용 + 사전/사후 점검으로 마이그레이션 수행
- 롤백 가능 구조를 유지하며 최종 정리까지 완료

## 후속 권장 (선택)

- 안정화 모니터링(짧은 기간)
  - 채팅 전송/첨부 Realtime
  - 앨범 업로드/다운로드/삭제
  - 여행/가계부 첨부 업로드
- 문제 없으면 관련 임시 계획 SQL 파일은 archive 폴더로 이동 검토

