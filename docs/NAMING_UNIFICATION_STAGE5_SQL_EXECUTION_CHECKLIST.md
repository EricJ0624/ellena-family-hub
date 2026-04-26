# Naming Unification - Stage 5 SQL Execution Checklist

목적: 테이블 rename SQL을 실행할 때 기능 회귀(채팅/사진/첨부)와 권한 회귀를 최소화한다.

전제:
- 이 문서는 **실행 체크리스트**이며, 자동 적용 문서가 아니다.
- SQL은 dev/staging에서 먼저 검증 후 운영 반영한다.

## 1) 실행 순서 (권장)

1. `feature_attachments -> attachments`
2. `family_messages -> family_chat_messages`
3. `memory_vault -> family_album_items` (마지막, 고위험)

이유:
- 첨부 테이블은 영향 범위가 상대적으로 작고 검증이 빠름
- 채팅은 영향 중간
- 앨범(`memory_vault`)은 API/대시보드/관리자/삭제 플로우에 넓게 연결됨

## 2) 사전 체크 (각 SQL 실행 직전)

1. 트래픽 낮은 시간대 확보
2. 현재 브랜치/배포 버전 고정 확인
3. Supabase 대상 프로젝트(환경) 재확인
4. 대상 테이블 존재/신규 이름 미존재 확인
5. 롤백 SQL 별도 탭 준비

## 3) 적용 단위 규칙

- 한 번에 SQL 1개만 실행
- 실행 직후 기능 검증 통과 전 다음 SQL 금지
- 문제 발생 시 다음 단계 진행 금지 후 즉시 롤백

## 4) SQL별 검증 시나리오

## 4.1 `feature_attachments -> attachments`

- 첨부 업로드(채팅/여행) 성공
- `/api/attachments` GET/POST/DELETE 성공
- `/api/attachments/complete` 성공
- 채팅 첨부 Realtime 반영 정상
- 권한: 업로더/ADMIN/OWNER 삭제 가능, 일반 멤버 타인 삭제 불가

## 4.2 `family_messages -> family_chat_messages`

- 채팅 초기 로드 정상
- 채팅 텍스트 전송/수정/삭제 정책 정상
- 채팅 첨부 메시지(빈 텍스트 + 이미지) 정상
- Realtime 수신/중복 방지 정상

## 4.3 `memory_vault -> family_album_items`

- 일반 업로드/완료 업로드 API 정상
- 앨범 목록/캡션 수정/다운로드/삭제 정상
- 그룹 삭제/회원 탈퇴 시 S3 정리 + DB 정리 정상
- 그룹 관리자 패널 통계/콘텐츠 탭 정상
- 저장 용량 계산(`storage-quota`) 정상

## 5) 공통 DB 검증 쿼리 (실행 직후)

```sql
-- 테이블 존재 확인
select table_name
from information_schema.tables
where table_schema='public'
  and table_name in ('attachments','feature_attachments','family_chat_messages','family_messages','family_album_items','memory_vault')
order by table_name;

-- RLS 활성화 상태
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname='public'
  and tablename in ('attachments','family_chat_messages','family_album_items');

-- 정책 존재 확인
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname='public'
  and tablename in ('attachments','family_chat_messages','family_album_items')
order by tablename, policyname;
```

## 6) 실패 기준 (즉시 롤백)

- 채팅 메시지 전송/수신 실패
- 사진 업로드/다운로드/삭제 중 1개라도 실패
- 첨부 삭제 권한 판정 오류
- RLS 정책 누락 또는 접근 거부 이상
- 운영 에러율 급증/사용자 제보 발생

## 7) 롤백 원칙

- 해당 SQL 파일 하단 rollback 블록을 즉시 실행
- 롤백 후 핵심 시나리오 재검증
- 원인 분석 완료 전 다음 SQL 재시도 금지

