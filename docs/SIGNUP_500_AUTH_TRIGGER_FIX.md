# Sign up 500 오류 수정 — Auth 트리거 search_path

## 요약 (Sign up이 안 될 때)

- **원인:** `auth.users` INSERT 시 실행되는 트리거 함수(`handle_new_user` 등)에 **SET search_path = public** 이 없어, Supabase Auth 실행 맥락에서 `public.profiles` 접근이 막혀 **500** 발생할 수 있음.
- **해결:** 프로젝트 루트의 **`supabase_fix_auth_trigger_search_path.sql`** 를 Supabase **SQL Editor**에서 한 번 실행하면 됨. (아래 "적용 방법" 참고.)

### 오류가 정말 500인지 확인하는 방법

앱은 가입 실패 시 "가입 실패: 정보를 확인해주세요."만 띄우므로, **실제 HTTP 상태가 500인지** 아래로 확인하는 것이 좋습니다.

1. **개발 환경에서:** Sign up 실패 후 **브라우저 개발자 도구(F12) → Console** 탭을 엽니다.  
   - `[Sign up] 오류:` 로 시작하는 로그에서 **`status`** 값 확인.  
   - `status: 500` 이면 서버(DB/트리거) 쪽 오류, `400` 이면 요청/설정 문제일 수 있음.
2. **Network 탭:** 개발자 도구 → **Network** 탭에서 Sign up 시 발생하는 **auth 관련 요청**(예: `signupWithPassword` 또는 `token?grant_type=password`)을 선택한 뒤 **Status** 컬럼 확인.  
   - `500` = 서버 에러, `400` = 잘못된 요청/중복 이메일 등.

## 원인

- Supabase Auth는 `auth.users` INSERT 시 **supabase_auth_admin** 역할로 트리거를 실행하며, 이 역할은 제한된 권한을 가짐.
- `handle_new_user()` 등 트리거 함수에 **SET search_path** 가 없으면, 최근 Supabase/PostgreSQL 보안·실행 맥락 변경으로 public 스키마 접근이 막혀 500 발생 가능.

## 적용한 수정 (마이그레이션: auth_trigger_functions_set_search_path)

다음 세 함수에 **SECURITY DEFINER** 유지 + **SET search_path = public** 추가:

1. **handle_new_user** — sign up 시 profiles INSERT (500 원인)
2. **handle_user_update** — auth.users 업데이트 시 profiles 동기화
3. **auto_add_system_admin** — 특정 이메일 시 system_admins INSERT

함수 내부에서 `profiles` 참조 시 **public.profiles** 로 스키마 명시.

### 이 프로젝트에서 수정 적용 방법

1. **Supabase Dashboard** → **SQL Editor** 에서 아래 파일 내용을 **전체 실행**합니다.  
   - 파일: **`supabase_fix_auth_trigger_search_path.sql`** (프로젝트 루트)

2. **적용 여부 확인** (같은 SQL Editor에서 실행):
   ```sql
   SELECT proname, proconfig
   FROM pg_proc
   WHERE proname IN ('handle_new_user','handle_user_update','auto_add_system_admin');
   ```
   - `proconfig` 에 `search_path=public` 이 포함되어 있으면 적용된 것입니다.

3. **로그에 `column "updated_at" of relation "profiles" does not exist` 일 때**  
   - **profiles** 테이블에 **updated_at** 컬럼이 없어서 트리거가 실패하는 경우입니다.  
   - **해결:** **`supabase_profiles_add_updated_at.sql`** 를 SQL Editor에서 실행해 주세요.

4. **search_path 적용했는데도 여전히 500일 때 (RLS INSERT 정책)**  
   - `handle_new_user` 트리거가 **public.profiles** 에 INSERT 할 때, **profiles 테이블에 INSERT 정책이 없으면** RLS 위반으로 500이 납니다.  
   - **해결:** **`supabase_profiles_insert_policy_for_trigger.sql`** 를 SQL Editor에서 실행해 주세요.  
   - (선택) **`supabase_signup_500_diagnose.sql`** 로 테이블/함수 소유자·정책 목록을 확인한 뒤, 소유자가 `postgres`가 아니면 INSERT 정책의 `current_user = 'postgres'` 부분을 실제 소유자 이름으로 바꿔 주세요.

5. **그래도 500일 때**
   - **Log Explorer** 에서 [Resolving 500 Status Authentication Errors](https://supabase.com/docs/guides/troubleshooting/resolving-500-status-authentication-errors-7bU5U8) 문서의 **Section 1** 쿼리로 DB 에러 확인.
   - **Auth 로그**에서 `status = 500` 또는 `level = error` 로 필터해 상세 메시지 확인.

## 사용자 삭제(강제 추방)와의 관계

- **auth.users 에는 DELETE 트리거가 없음.** (확인: INSERT 트리거 2개, UPDATE 트리거 1개만 존재)
- 따라서 **이번 정책/트리거 실행 맥락 변경은 사용자 삭제(deleteUser)에는 영향을 주지 않음.**
- 사용자 삭제 실패는 FK 제약(그룹 소유·멤버십 등) 또는 앱 측 처리 순서 때문일 가능성이 큼.

## 사용자 삭제 오류와 Supabase 최근 정책 변경

### 결론: **삭제 실패는 트리거/정책 리뉴얼과 무관**

- **auth.users 에는 DELETE 트리거가 없음** (INSERT 2개, UPDATE 1개만 존재).  
  Sign up 500 원인이었던 “트리거 실행 맥락(search_path)” 변경은 **DELETE 시에는 실행되지 않으므로 사용자 삭제에 영향 없음.**

### Supabase 쪽 사용자 삭제 오류 원인 (공식·이슈 기준)

- **[Errors when creating/updating/deleting users](https://supabase.com/docs/guides/troubleshooting/dashboard-errors-when-managing-users-N1ls4A)**  
  - **Constraint(FK)**  
    - 다른 테이블이 `auth.users`를 참조할 때 **CASCADE/SET NULL** 이 아니면 삭제가 막힘.  
  - **Trigger**  
    - auth.users 에 걸린 트리거가 실패하면 삭제도 실패. (우리 프로젝트는 DELETE 트리거 없음.)  
  - **Permission**  
    - Prisma 등으로 auth 스키마 권한이 꼬인 경우.

- **GitHub #30879 "Database error deleting user"**  
  - 대부분 **FK로 막힌 경우**.  
  - 해결 사례: 참조 테이블의 `ON DELETE` 를 CASCADE(또는 SET NULL)로 바꾸거나, 관련 행을 먼저 삭제한 뒤 사용자 삭제.

- **2024년 12월 deleteUser API 변경 (PR #31095)**  
  - deprecated 엔드포인트 대신 새 엔드포인트 사용으로 변경.  
  - “auth.users 스키마 수정 시, 전체 user 객체를 넘기면 삭제 실패” 하는 케이스를 다룸.  
  - 우리 앱은 `deleteUser(userId)` 처럼 **id만 전달**하므로 이 변경의 영향은 적은 편.

### 이 프로젝트에서의 정리

- **트리거:** DELETE 트리거 없음 → sign up 때 썼던 “정책/트리거 리뉴얼”은 **사용자 삭제와 무관**.  
- **FK:** `docs/AUTH_USERS_FK_DELETE_RULE_PLAN.md` 에 따라 travel_* 등 CASCADE 정리 완료.  
- 삭제가 여전히 실패하면 **Auth 로그 / Postgres 로그**에서 `Database error deleting user` 상세 메시지 확인 후, **auth.users 를 참조하는 테이블의 ON DELETE** 를 점검하면 됨.

---

## 참고

- [Resolving 500 Status Authentication Errors](https://supabase.com/docs/guides/troubleshooting/resolving-500-status-authentication-errors-7bU5U8)
- [Errors when creating/updating/deleting users](https://supabase.com/docs/guides/troubleshooting/dashboard-errors-when-managing-users-N1ls4A)
- Trigger has insufficient privileges (42501) 시 SECURITY DEFINER + search_path 명시 권장
