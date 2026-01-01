# Web Push 알림 설정 가이드

## 개요

이 가이드는 Web Push API를 사용하여 푸시 알림을 구현하는 방법을 설명합니다. Supabase를 사용하여 구현합니다.

## 1. VAPID 키 생성

VAPID (Voluntary Application Server Identification) 키는 Web Push API에서 푸시 알림을 보내기 위해 필요한 공개/비공개 키 쌍입니다.

### 1.1 Node.js로 VAPID 키 생성

터미널에서 다음 명령어 실행:

```bash
npm install -g web-push
web-push generate-vapid-keys
```

또는 프로젝트에 `web-push`가 설치되어 있다면:

```bash
npx web-push generate-vapid-keys
```

출력 예시:
```
Public Key: BEl62iUYgUivxIkv69yViEuiBIa40HI9Hk3WgTtKU1tX...
Private Key: 8V1F8EqbyUbVy2wMzkub56qnpL3vky7T1Cu2YaG1...
```

### 1.2 온라인 도구 사용

[web-push-codelab.appspot.com](https://web-push-codelab.appspot.com/)에서도 VAPID 키를 생성할 수 있습니다.

## 2. 환경 변수 설정

### 2.1 로컬 환경 (`.env.local`)

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가:

```env
# Web Push VAPID 키 (Supabase만 사용)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key_here
VAPID_PRIVATE_KEY=your_vapid_private_key_here
VAPID_EMAIL=mailto:your-email@example.com

# 앱 URL (푸시 알림 링크용)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**중요**: 
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: 클라이언트에서 사용 (공개 키)
- `VAPID_PRIVATE_KEY`: 서버에서만 사용 (비공개 키, 절대 노출 금지)
- `VAPID_EMAIL`: VAPID 식별자 (mailto: 형식 권장)

### 2.2 Vercel 배포 환경

1. Vercel 대시보드 > 프로젝트 선택
2. **Settings** > **Environment Variables**
3. 위의 모든 환경 변수 추가
4. **Save** 후 재배포

## 3. Supabase 데이터베이스 설정

### 3.1 Push 토큰 테이블 생성

1. [Supabase Dashboard](https://app.supabase.com/)에 접속
2. 프로젝트 선택 > **SQL Editor** 메뉴로 이동
3. `supabase_push_tokens.sql` 파일의 전체 내용을 복사
4. SQL Editor에 붙여넣기
5. **RUN** 버튼 클릭
6. "Success" 메시지 확인

### 3.2 보안 강화 설정 (선택 사항)

1. `supabase_security_enhancements.sql` 파일의 내용을 SQL Editor에 붙여넣기
2. **RUN** 버튼 클릭
3. "Success" 메시지 확인

## 4. 백그라운드 위치 권한 설정

### 4.1 웹 브라우저

웹 브라우저에서는 백그라운드 위치 추적이 제한적입니다. 다음을 확인하세요:

1. **HTTPS 필수**: 백그라운드 위치 추적은 HTTPS에서만 작동합니다.
2. **Service Worker 활성화**: Service Worker가 등록되어 있어야 합니다.
3. **권한 요청**: 사용자가 위치 권한을 허용해야 합니다.

### 4.2 PWA (Progressive Web App) 설정

더 나은 백그라운드 지원을 위해 PWA로 설치:

1. `next.config.ts`에 PWA 설정 추가 (예: `next-pwa` 패키지 사용)
2. `manifest.json` 생성
3. 사용자에게 "홈 화면에 추가" 안내

## 5. 테스트

### 5.1 Push 토큰 등록 확인

1. 앱 로그인
2. 브라우저 개발자 도구 (F12) > **Console** 탭
3. "Web Push 토큰 등록 성공" 메시지 확인
4. Supabase Dashboard > **Table Editor** > `push_tokens` 테이블에서 토큰 확인

### 5.2 푸시 알림 테스트

1. 두 개의 브라우저 창 열기 (또는 두 명의 사용자)
2. 한 사용자가 다른 사용자에게 위치 요청 보내기
3. 요청받은 사용자의 브라우저에서 알림 확인

### 5.3 백그라운드 위치 추적 테스트

1. 위치 공유 시작
2. 브라우저 탭을 백그라운드로 이동 (다른 탭으로 전환)
3. 개발자 도구 > **Application** > **Service Workers**에서 활성 상태 확인
4. 위치가 계속 업데이트되는지 확인

## 6. 문제 해결

### 6.1 Push 토큰을 가져올 수 없음

- **원인**: 알림 권한이 거부됨
- **해결**: 브라우저 설정에서 알림 권한 허용

### 6.2 Service Worker 등록 실패

- **원인**: HTTPS가 아니거나 Service Worker 파일 경로 오류
- **해결**: 
  - 로컬 개발: `localhost` 사용 (HTTPS 불필요)
  - 프로덕션: HTTPS 필수
  - `sw.js` 파일이 `public/` 폴더에 있는지 확인

### 6.3 백그라운드 위치 추적이 작동하지 않음

- **원인**: 브라우저가 백그라운드 위치 추적을 제한
- **해결**: 
  - Chrome: 백그라운드 위치 추적은 제한적
  - PWA로 설치하면 더 나은 지원
  - 모바일 브라우저에서는 더 나은 지원

### 6.4 푸시 알림이 도착하지 않음

- **원인**: VAPID 키 오류 또는 토큰 만료
- **해결**:
  - `VAPID_PRIVATE_KEY`와 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`가 올바른지 확인
  - Push 토큰이 Supabase에 등록되어 있는지 확인
  - 브라우저 콘솔에서 에러 메시지 확인

## 7. 보안 고려사항

1. **VAPID 비공개 키 보호**: 절대 클라이언트에 노출하지 마세요.
2. **토큰 암호화**: 민감한 Push 토큰은 암호화하여 저장하는 것을 권장합니다.
3. **RLS 정책**: Supabase RLS 정책이 올바르게 설정되어 있는지 확인하세요.
4. **위치 데이터 접근 제어**: 승인된 사용자만 위치를 볼 수 있도록 보안 규칙을 설정하세요.

## 8. Web Push API의 장점

### 장점
- ✅ 추가 서비스 의존성 없음
- ✅ Supabase만 사용하여 단순화
- ✅ 무료 (Supabase 무료 티어 사용)
- ✅ 표준 Web API 사용 (브라우저 네이티브 지원)

## 9. 추가 리소스

- [Web Push API 문서](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API 문서](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Geolocation API 문서](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [VAPID 설명](https://web.dev/push-notifications-web-push-protocol/)

