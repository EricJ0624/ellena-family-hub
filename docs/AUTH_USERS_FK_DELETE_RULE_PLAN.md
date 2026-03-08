# auth.users FK delete_rule 수정 계획 (최종 확정)

## 1. 확정된 정책 (테이블 분류)

| 분류 | 테이블 | 권장 delete_rule | 핵심 로직 |
|------|--------|------------------|-----------|
| **개인/소유** | travel_* 전부 | **CASCADE** | 사용자 삭제 시 여행 데이터도 물리 삭제 |
| **운영/감사** | admin_audit_log, system_admins | **SET NULL** | 누가 했는지는 null로 두고 로그/기록은 보존 |
| **상호작용** | support_tickets, announcements | **SET NULL** | 작성자/답변자 나가도 티켓·공지 내용 유지 |
| **(보조)** | dashboard_access_requests.approved_by | **SET NULL** | 승인자만 null, 요청 이력 보존 |

---

## 2. 스키마 확인 결과 (2025 기준)

### 2.1 SET NULL 유지 테이블 — nullable 여부

아래 컬럼은 이미 **nullable(YES)** 이라 ON DELETE SET NULL 그대로 사용 가능. **컬럼 변경 없음.**

| 테이블 | 컬럼 | is_nullable | 조치 |
|--------|------|-------------|------|
| admin_audit_log | target_user_id | YES | 유지 |
| announcements | created_by | YES | 유지 |
| dashboard_access_requests | approved_by | YES | 유지 |
| support_tickets | created_by, answered_by | YES | 유지 |
| system_admins | created_by | YES | 유지 |
| travel_accommodations | created_by, updated_by, deleted_by | YES | → FK만 CASCADE로 변경 |
| travel_dining | created_by, updated_by, deleted_by | YES | → FK만 CASCADE로 변경 |
| travel_expenses | created_by, paid_by, updated_by, deleted_by | YES | → FK만 CASCADE로 변경 |
| travel_itineraries | created_by, updated_by, deleted_by | YES | → FK만 CASCADE로 변경 |
| travel_trips | updated_by, deleted_by | YES | → FK만 CASCADE로 변경 |

### 2.2 NOT NULL 컬럼 (CASCADE여서 수정 불필요)

| 테이블 | 컬럼 | is_nullable | FK delete_rule | 비고 |
|--------|------|-------------|----------------|------|
| admin_audit_log | admin_id | NO | CASCADE | 유지 |
| dashboard_access_requests | requested_by | NO | CASCADE | 유지 |
| system_admins | user_id | NO | CASCADE | 유지 |
| travel_trips | created_by | NO | CASCADE | 유지 |

→ SET NULL이 아닌 CASCADE라 삭제 시 행 자체가 삭제되므로 NOT NULL과 충돌 없음.

---

## 3. 실제 수정 작업 (마이그레이션 대상)

**해야 할 일:**  
`auth.users`를 참조하면서 현재 **ON DELETE SET NULL**인 **travel_*** 관련 FK만 **ON DELETE CASCADE**로 변경.

- **변경 대상 (FK만 DROP 후 CASCADE로 재생성):**
  - `travel_accommodations`: created_by, updated_by, deleted_by
  - `travel_dining`: created_by, updated_by, deleted_by
  - `travel_expenses`: created_by, paid_by, updated_by, deleted_by
  - `travel_itineraries`: created_by, updated_by, deleted_by
  - `travel_trips`: updated_by, deleted_by (created_by는 이미 CASCADE)

- **변경하지 않음:**
  - 운영/감사/상호작용 테이블(admin_audit_log, system_admins, support_tickets, announcements, dashboard_access_requests) → 현재 SET NULL + nullable 그대로 유지.
  - 이미 CASCADE인 테이블/컬럼 → 변경 없음.

---

## 4. 요약

- **정책:** 개인/소유(travel_*) = CASCADE, 운영·감사·상호작용 = SET NULL → **확정.**
- **스키마:** SET NULL 쓰는 컬럼은 이미 nullable → **ALTER COLUMN 불필요.**
- **수정 범위:** travel_* 테이블의 auth.users 참조 FK 중 SET NULL인 것만 CASCADE로 바꾸는 **마이그레이션만** 진행하면 됨.

이후 단계: 위 변경에 맞춰 `ALTER TABLE ... DROP CONSTRAINT` / `ADD CONSTRAINT ... ON DELETE CASCADE` 마이그레이션 파일 작성 후 적용 및 테스트.

---

## 5. 적용 이력

- **적용일:** 2025-03-08  
- **마이그레이션명:** `travel_fk_auth_users_cascade`  
- **SQL 파일:** `supabase_travel_fk_auth_users_cascade.sql`  
- **결과:** travel_accommodations, travel_dining, travel_expenses, travel_itineraries, travel_trips 의 auth.users 참조 FK 14개 모두 ON DELETE CASCADE 로 적용 완료.  
- **검증:** Supabase MCP `execute_sql` 로 delete_rule 조회 시 전부 CASCADE 확인됨.
