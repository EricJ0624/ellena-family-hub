# 관리자 감사 로그 설계안

## 1. 목표

- **법적·운영적 추적**: 관리자(시스템 관리자)가 **누가, 언제, 어떤 데이터에 대해** 접근·삭제·복구했는지 기록
- **기존 자산 활용**: 이미 있는 `dashboard_access_logs` 활용 + 부족한 부분만 보완

---

## 2. 감사 대상 정리

| 구분 | 내용 | 현재 상태 |
|------|------|-----------|
| **대시보드 접근** | 시스템 관리자가 그룹 대시보드(또는 특정 그룹 데이터)에 접속한 시점 | 테이블 있음, **앱에서 INSERT 없음** |
| **데이터 삭제** | 관리자가 사진/이벤트/그룹/사용자/공지/티켓 등 삭제 | 전용 로그 **없음** |
| **데이터 복구** | 소프트 삭제 복구 등 관리자에 의한 복구 | 전용 로그 **없음** |
| **민감 작업** | 계정 삭제, 시스템 관리자 지정/해제, 그룹 삭제 등 | 전용 로그 **없음** |

---

## 3. 테이블 설계

### 3.1 대시보드 접근 로그 (기존 테이블 활용)

**테이블**: `dashboard_access_logs` (이미 존재)

| 컬럼 | 용도 |
|------|------|
| `system_admin_id` | 접속한 시스템 관리자 |
| `group_id` | 접근한 그룹 |
| `accessed_at` | 접속 시각 |
| `session_duration_seconds` | (선택) 세션 종료 시 채움 |
| `ip_address`, `user_agent` | (선택) 요청 정보 |

**로그 남기는 시점**

- 시스템 관리자가 **특정 그룹 대시보드에 “접근”한 순간** (관리자 페이지에서 그룹 선택 후 대시보드/그룹 데이터 보기 진입 시)
- 가능하면 **접근 요청(`dashboard_access_requests`) 승인 후 해당 그룹 데이터를 최초로 조회할 때** 1건 INSERT

**구현 위치(참고)**

- `/admin` 페이지에서 그룹 선택 후 대시보드/그룹 데이터를 로드하는 시점  
  → 그 직전/직후에 API 1회 호출하여 `dashboard_access_logs`에 1행 INSERT

---

### 3.2 관리자 작업 로그 (신규 테이블 제안)

**테이블**: `admin_audit_log` (신규)

```
목적: 시스템 관리자가 “데이터를 삭제/복구/변경”한 행위만 기록
```

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | UUID | O | PK, 기본값 gen_random_uuid() |
| `admin_id` | UUID | O | 작업한 시스템 관리자 (auth.users.id) |
| `action` | TEXT | O | 'DELETE' \| 'RESTORE' \| 'UPDATE' \| 'GRANT' 등 |
| `resource_type` | TEXT | O | 대상 리소스: 'photo', 'family_event', 'group', 'user', 'announcement', 'support_ticket', 'dashboard_access_request', 'piggy_bank_account' 등 |
| `resource_id` | TEXT | △ | 대상 row의 id (UUID 등). 복합키면 JSON 등으로 저장 가능 |
| `group_id` | UUID | △ | 해당 그룹 (있을 경우) |
| `target_user_id` | UUID | △ | 대상 사용자(예: 삭제된 계정, 사진 업로더) |
| `details` | JSONB | △ | 요약: { "reason": "문의에 따른 삭제", "ticket_id": "..." } 등 |
| `ip_address` | TEXT | △ | 요청 IP |
| `user_agent` | TEXT | △ | User-Agent |
| `created_at` | TIMESTAMPTZ | O | DEFAULT NOW() |

**인덱스 제안**

- `admin_id`, `created_at DESC` (관리자별 이력 조회)
- `resource_type`, `resource_id` (특정 리소스 이력 조회)
- `group_id`, `created_at DESC` (그룹별 조회)
- `created_at DESC` (전체 기간 조회)

**RLS**

- 이 테이블은 **시스템 관리자만** SELECT 가능 (또는 서비스 계정만 접근)
- INSERT는 **백엔드(API)에서만** 하고, 클라이언트는 직접 INSERT 불가 (서비스 역할 또는 SECURITY DEFINER 함수 사용)

---

## 4. 로그를 남겨야 하는 시점 (앱/API 기준)

### 4.1 대시보드 접근

- **시점**: 시스템 관리자가 특정 그룹의 대시보드(또는 해당 그룹 데이터)를 **최초로 조회할 때** 1회
- **방법**:  
  - 관리자 전용 API 예: `POST /api/admin/audit/dashboard-access`  
  - body: `{ group_id, access_request_id? }`  
  - 서버에서 `is_system_admin` 확인 후 `dashboard_access_logs`에 INSERT

### 4.2 관리자 작업 로그 (admin_audit_log)

아래 작업이 **시스템 관리자에 의해** 수행될 때마다 1건 INSERT를 권장합니다.

| API/화면 | resource_type | action | 비고 |
|----------|----------------|--------|------|
| 그룹 삭제 | `group` | DELETE | `resource_id` = group id |
| 사용자(계정) 삭제/정지 | `user` | DELETE / UPDATE | `target_user_id` = 해당 user_id |
| 공지 삭제 | `announcement` | DELETE | |
| 대시보드 접근 요청 삭제/거절 | `dashboard_access_request` | DELETE / UPDATE | |
| 지원 티켓 삭제/상태 변경 | `support_ticket` | DELETE / UPDATE | |
| 시스템 관리자 추가/해제/이전 | (별도 타입 또는 `system_admin`) | GRANT / REVOKE / TRANSFER | |
| (추후) 사진/이벤트 관리자 삭제 | `photo` / `family_event` | DELETE / RESTORE | 해당 API 추가 시 |

**공통**

- `admin_id`: 요청한 세션의 `auth.uid()` (시스템 관리자 여부는 이미 체크된 뒤 로그만 남김)
- `ip_address` / `user_agent`: Next.js API에서 `headers()` 로 수집 가능하면 저장

---

## 5. 보관·조회 정책

- **보관 기간**  
  - 법적 요구가 없으면 보통 **1년~3년** 보관 후 삭제 또는 아카이브  
  - 개인정보보호법 등에서 별도 기간이 정해지면 그에 맞춤
- **조회**  
  - 시스템 관리자 전용 화면 또는 내부용 API에서만 조회  
  - 검색 조건: 기간, admin_id, group_id, resource_type, resource_id 등
- **삭제**  
  - `admin_audit_log`는 “감사” 목적이므로 일반 사용자/그룹 관리자에게는 노출·삭제 권한 없음  
  - 보관 기간 경과 분만 주기적으로 삭제 (배치 또는 pg_cron)

---

## 6. 구현 순서 제안

1. **DB**  
   - `admin_audit_log` 테이블 + 인덱스 + RLS 생성 (마이그레이션 SQL 1개)
2. **대시보드 접근**  
   - `POST /api/admin/audit/dashboard-access` 추가  
   - 관리자 페이지에서 “그룹 선택 후 대시보드/그룹 데이터 로드” 시 1회 호출  
   - `dashboard_access_logs`에 INSERT
3. **관리자 작업 로그**  
   - 공통 헬퍼 예: `writeAdminAuditLog({ adminId, action, resourceType, resourceId, groupId?, targetUserId?, details? })`  
   - 그다음 **영향 큰 것부터**: 그룹 삭제, 사용자 삭제/정지, 시스템 관리자 변경, 공지/접근요청/티켓 삭제 등에서 호출
4. **(선택)**  
   - 관리자용 “감사 로그 조회” 페이지 또는 CSV 내보내기 API

---

## 7. 참고 사항

- **IP/User-Agent**는 개인정보에 해당할 수 있으므로, 보관 기간·접근 권한을 정책에 명시하는 것이 좋습니다.
- **details**에는 개인 식별 정보를 최소한만 넣고, “문의 번호, 사유 요약” 수준으로 두면 리스크가 적습니다.
- 사진/이벤트 등은 현재는 **사용자·그룹 관리자 삭제**만 있을 수 있으므로, “시스템 관리자가 대신 삭제/복구하는 기능”을 넣을 때 그 시점에 `admin_audit_log`를 붙이면 됩니다.
