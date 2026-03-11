# Supabase 스키마 점검 (MCP list_tables + types/db.ts 비교)

**점검일**: 2026-03  
**방법**: MCP user-supabase `list_tables(schemas: ['public'], verbose: true)` 결과와 `types/db.ts` 및 코드 사용처 비교.

---

## 1. 수정 반영 사항

### 1.1 types/db.ts — 실제 DB 컬럼 반영

| 테이블 | 추가/수정한 컬럼 |
|--------|------------------|
| **profiles** | `display_name`, `avatar_url`, `role` (실제 DB에 있음, 타입에만 누락되어 추가) |
| **groups** | `avatar_url`, `invite_code_expires_at` |
| **user_locations** | `group_id` (실제 DB에 있음) |
| **family_events** | `location` |
| **announcement_reads** | `id` (PK, Row/Insert/Update에 추가) |
| **memory_vault** | `description` (caption과 별도 컬럼) |

### 1.2 admin/page.tsx — user_locations 컬럼명

- **문제**: `user_locations`에는 `updated_at`이 없고 `last_updated`만 있음.
- **수정**: `.select(..., 'updated_at')` → `.select(..., 'last_updated')` 로 변경.
- **매핑**: `LocationInfo`는 계속 `updated_at`을 쓰므로, 조회 결과의 `last_updated`를 `updated_at`으로 매핑해 사용.

---

## 2. 실제 DB 테이블 목록 (public)

- profiles  
- family_tasks, family_events, family_messages  
- memory_vault  
- push_tokens  
- groups, memberships  
- system_admins  
- location_requests, user_locations  
- piggy_bank_accounts, piggy_wallets, piggy_wallet_transactions, piggy_bank_transactions  
- piggy_open_requests, piggy_open_approvals  
- piggy_account_requests  
- announcements, announcement_reads  
- support_tickets  
- dashboard_access_requests  
- admin_audit_log  
- travel_trips, travel_itineraries, travel_expenses, travel_accommodations, travel_dining  

---

## 3. 참고 사항

- **user_locations.group_id**: 실제 DB에는 존재. 대시보드의 `user_locations` upsert는 현재 `group_id`를 보내지 않음.  
  - DB에서 `group_id`가 NOT NULL이고 기본값이 없다면, 해당 upsert는 실패할 수 있음.  
  - 필요 시 upsert에 `group_id` 포함하거나, DB에 default/nullable 설정 확인 필요.
- **memory_vault**: 코드는 `caption`만 사용 중이며, `description`은 타입에만 맞춰 두었음.
- **profiles**: 코드는 `id`, `email`, `nickname` 위주로 사용. `display_name`, `avatar_url`, `role`은 타입 정합성만 맞춤.

---

*MCP list_tables(verbose: true) 결과와 types/db.ts 비교 후 위와 같이 반영함.*
