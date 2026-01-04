# 프로젝트 에러 스캔 보고서

**스캔 일시**: 2024년  
**프로젝트**: ellena-family-hub (Next.js 16.1.1)

---

## 📊 전체 요약

- **치명적 에러**: 8개 발견
- **잠재적 에러**: 4개 발견  
- **단순 정리 필요**: 3개 발견

---

## 🔴 치명적 에러 (앱 중단 가능)

### 1. 환경 변수 Non-null Assertion 사용 (7개 파일)

**문제**: 환경 변수에 `!` (non-null assertion)를 사용하여 런타임에 `undefined`일 경우 앱이 크래시됩니다.

**영향 파일**:
- `app/api/location-request/route.ts` (4-5줄)
- `app/api/location-approve/route.ts` (4-5줄)
- `app/api/push/register-token/route.ts` (5-6줄)
- `app/api/push/send/route.ts` (18-21줄)
- `app/api/users/list/route.ts` (5-6줄)
- `lib/api-helpers.ts` (47-49줄)

**예시 코드**:
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!; // ❌ 위험
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // ❌ 위험
```

**해결 방법**: 환경 변수 체크 추가
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('필수 환경 변수가 설정되지 않았습니다.');
}
```

---

### 2. 클라이언트용 Supabase를 서버에서 사용

**파일**: `app/api/upload/route.ts` (3줄)

**문제**: 
```typescript
import { supabase } from '@/lib/supabase'; // ❌ 클라이언트용
```

`lib/supabase.ts`는 클라이언트용으로 설계되었는데, 서버 사이드 API 라우트에서 사용하고 있습니다. 이는 세션 관리 문제를 일으킬 수 있습니다.

**해결 방법**: 서버 사이드용 Supabase 클라이언트 사용
```typescript
// lib/api-helpers.ts의 getSupabaseServerClient() 사용
import { getSupabaseServerClient } from '@/lib/api-helpers';
```

---

## 🟡 잠재적 에러 (기능 오작동 가능)

### 1. 서버 사이드에서 window 객체 사용

**파일**: `lib/webpush.ts` (55줄)

**문제**:
```typescript
const rawData = window.atob(base64); // ❌ 서버에서 실행 시 에러
```

`urlBase64ToUint8Array` 함수가 서버 사이드에서 실행될 경우 `window`가 없어 에러가 발생합니다.

**해결 방법**: 브라우저 체크 추가
```typescript
function urlBase64ToUint8Array(base64String: string): BufferSource {
  if (typeof window === 'undefined') {
    // Node.js 환경에서는 Buffer 사용
    return Buffer.from(base64String, 'base64');
  }
  // 브라우저 환경
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  // ... 나머지 코드
}
```

---

### 2. SSR에서 window.location 사용

**파일**: 
- `app/page.tsx` (181줄)
- `app/reset-password/page.tsx` (17줄)

**문제**:
```typescript
redirectTo: `${window.location.origin}/reset-password` // ❌ SSR에서 에러 가능
```

**해결 방법**: 클라이언트 사이드에서만 실행되도록 체크
```typescript
// app/page.tsx
const redirectTo = typeof window !== 'undefined' 
  ? `${window.location.origin}/reset-password`
  : '/reset-password'; // 기본값 사용

// app/reset-password/page.tsx
useEffect(() => {
  if (typeof window === 'undefined') return;
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  // ...
}, []);
```

---

### 3. dashboard/page.tsx의 window 사용

**파일**: `app/dashboard/page.tsx` (2548, 2557, 4443줄)

**문제**: `window.addEventListener`, `window.Image` 사용이 SSR에서 문제를 일으킬 수 있습니다.

**현재 상태**: `'use client'` 지시어가 있어서 클라이언트에서만 실행되지만, 안전성을 위해 체크 추가 권장.

---

## 🟢 단순 정리 필요

### 1. 불필요한 빈 줄

**파일**:
- `app/api/complete-upload/route.ts` (129-135줄): 끝부분에 빈 줄 4개
- `app/api/location-approve/route.ts` (128-129줄): 끝부분에 빈 줄 1개

**해결**: 불필요한 빈 줄 제거

---

### 2. Import 경로 확인

**상태**: ✅ 모든 import 경로가 올바릅니다.
- `@/lib/*` 경로 사용 정상
- `@/app/components/*` 경로 사용 정상
- 상대 경로(`../`) 사용 없음

---

## 📝 권장 수정 우선순위

1. **즉시 수정 필요** (치명적 에러):
   - 환경 변수 non-null assertion 제거 및 체크 추가
   - `app/api/upload/route.ts`의 supabase import 수정

2. **빠른 시일 내 수정** (잠재적 에러):
   - `lib/webpush.ts`의 window.atob 서버 사이드 처리
   - `app/page.tsx`, `app/reset-password/page.tsx`의 window.location 체크

3. **여유 있을 때 정리** (단순 정리):
   - 불필요한 빈 줄 제거

---

## ✅ 정상 작동하는 부분

- TypeScript 컴파일: 에러 없음
- ESLint: 에러 없음
- Import 경로: 모두 정상
- 타입 정의: 적절히 사용됨
- 기본적인 에러 핸들링: 대부분 구현됨

---

## 🔍 추가 확인 사항

1. **환경 변수 설정 확인**: `.env.local` 파일에 모든 필수 환경 변수가 설정되어 있는지 확인하세요.
2. **빌드 테스트**: `npm run build` 실행하여 프로덕션 빌드 시 문제가 없는지 확인하세요.
3. **런타임 테스트**: 각 API 엔드포인트를 실제로 호출하여 환경 변수 누락 시 적절한 에러 메시지가 나오는지 확인하세요.

---

**보고서 생성 완료**


