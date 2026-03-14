# 앱 버전 전환 시 할 일

앱(네이티브/패키징) 버전으로 변환할 때 적용할 항목 메모.

---

## Single session per user (1계정 1기기)

- **목표:** 동일 계정으로 여러 기기 동시 로그인 불가, 1계정 1기기 1시점만 로그인 유지.
- **선택지:**
  1. **Supabase Pro 플랜 사용 시:** 대시보드 → Authentication → Sessions에서 **Single session per user** 옵션 활성화.
  2. **무료 플랜 유지 시:** 로그인 성공 직후 클라이언트에서 `supabase.auth.signOut({ scope: 'others' })` 호출하여, 현재 기기만 남기고 나머지 세션 무효화.
- **참고:** `signOut({ scope: 'others' })` 는 플랜 제한 없이 사용 가능.

---

*이 파일은 앱 버전 전환 시 참고용입니다. 필요 시 항목 추가.*
