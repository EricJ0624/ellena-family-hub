# Sign up 500 오류 수정 — Auth 트리거 search_path

## 원인

- Supabase Auth는 `auth.users` INSERT 시 **supabase_auth_admin** 역할로 트리거를 실행하며, 이 역할은 제한된 권한을 가짐.
- `handle_new_user()` 등 트리거 함수에 **SET search_path** 가 없으면, 최근 Supabase/PostgreSQL 보안·실행 맥락 변경으로 public 스키마 접근이 막혀 500 발생 가능.

## 적용한 수정 (마이그레이션: auth_trigger_functions_set_search_path)

다음 세 함수에 **SECURITY DEFINER** 유지 + **SET search_path = public** 추가:

1. **handle_new_user** — sign up 시 profiles INSERT (500 원인)
2. **handle_user_update** — auth.users 업데이트 시 profiles 동기화
3. **auto_add_system_admin** — 특정 이메일 시 system_admins INSERT

함수 내부에서 `profiles` 참조 시 **public.profiles** 로 스키마 명시.

## 사용자 삭제(강제 추방)와의 관계

- **auth.users 에는 DELETE 트리거가 없음.** (확인: INSERT 트리거 2개, UPDATE 트리거 1개만 존재)
- 따라서 **이번 정책/트리거 실행 맥락 변경은 사용자 삭제(deleteUser)에는 영향을 주지 않음.**
- 사용자 삭제 실패는 FK 제약(그룹 소유·멤버십 등) 또는 앱 측 처리 순서 때문일 가능성이 큼.

## 참고

- [Resolving 500 Status Authentication Errors](https://supabase.com/docs/guides/troubleshooting/resolving-500-status-authentication-errors-7bU5U8)
- Trigger has insufficient privileges (42501) 시 SECURITY DEFINER + search_path 명시 권장
