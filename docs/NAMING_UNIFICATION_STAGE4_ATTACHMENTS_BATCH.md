# Naming Unification - Stage 4 (Attachments Batch)

목표: `feature_attachments` 명칭을 `attachments`로 전환하되, 기능 회귀(채팅/사진/업로드)를 막는다.

## 1) 배치 범위 (2~4 파일 원칙)

- 코드(완료):
  - `lib/db-table-names.ts`
  - `app/api/attachments/route.ts`
  - `app/api/attachments/complete/route.ts`
  - `app/features/family-chat/hooks/useFamilyChatRealtime.ts`
- SQL(초안 작성):
  - `supabase_rename_feature_attachments_to_attachments_plan.sql`

## 2) 이번 배치에서 이미 반영된 안전 조치

- 하드코딩된 `feature_attachments` 문자열을 상수(`DB_TABLES.ATTACHMENTS`)로 치환
- 실시간 채널명/테이블명도 상수 기반으로 통일
- 동작 로직(인증/가입/권한/검증 분기)은 변경하지 않음

## 3) 적용 전 체크리스트 (필수)

1. 운영 시간대 피해서 작업 창 확보
2. DB 백업/스냅샷 또는 즉시 롤백 가능 상태 확보
3. 현재 코드가 최신 배포 상태인지 확인
4. SQL 적용 전 `list_tables(verbose=true)`로 현행 스키마 재확인

## 4) SQL 적용 순서

1. `supabase_rename_feature_attachments_to_attachments_plan.sql` 리뷰
2. 스테이징(또는 dev) DB에 먼저 실행
3. 아래 기능 검증 통과 후 운영 반영

## 5) 기능 회귀 검증 (너가 걱정한 항목 우선)

- 채팅
  - 메시지 전송 후 첨부 이미지 표시 정상
  - Realtime로 새 첨부 반영 정상
- 첨부 API
  - `/api/attachments` GET/POST/DELETE 정상
  - `/api/attachments/complete` POST 정상
- 사진 업로드/다운로드
  - 기존 앨범 업로드/다운로드 경로 영향 없음(별도 테이블)
- 권한
  - 업로더 본인 삭제 가능
  - 그룹 ADMIN/OWNER 삭제 가능
  - 일반 멤버 타인 첨부 삭제 불가

## 6) 실패 시 롤백

- SQL 파일 하단 rollback 블록 사용
- 롤백 후 즉시 아래 3가지 확인:
  - 첨부 조회
  - 첨부 삭제 권한
  - 채팅 Realtime 첨부 반영

## 7) 다음 배치 후보

- `family_messages -> family_chat_messages` (중위험)
- `memory_vault -> family_album_items`는 고위험이므로 마지막 배치

