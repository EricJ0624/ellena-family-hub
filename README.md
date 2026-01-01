This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## 환경 변수 설정

### Web Push 알림 설정

위치 요청 시 푸시 알림을 받으려면 Web Push API 설정이 필요합니다. Supabase를 사용하여 구현합니다.

#### 1. VAPID 키 생성

터미널에서 다음 명령어 실행:

```bash
npm install -g web-push
web-push generate-vapid-keys
```

또는 프로젝트에 `web-push`가 설치되어 있다면:

```bash
npx web-push generate-vapid-keys
```

생성된 Public Key와 Private Key를 복사하세요.

#### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가:

```env
# Web Push VAPID 키 (Supabase만 사용)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key_here
VAPID_PRIVATE_KEY=your_vapid_private_key_here
VAPID_EMAIL=mailto:your-email@example.com

# 앱 URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### 3. Supabase 데이터베이스 설정

1. [Supabase Dashboard](https://app.supabase.com/)에 접속
2. 프로젝트 선택 > **SQL Editor** 메뉴로 이동
3. `supabase_push_tokens.sql` 파일의 전체 내용을 복사하여 실행
4. "Success" 메시지 확인

자세한 설정 방법은 `WEB_PUSH_SETUP.md` 파일을 참고하세요.

### Google Maps API 키 설정 (위치 공유 기능용)

위치 공유 기능을 사용하려면 Google Maps API 키가 필요합니다. 무료 티어로 사용 가능합니다.

#### 1. Google Cloud Console에서 API 키 발급받기

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속하여 로그인
2. 새 프로젝트 생성 (또는 기존 프로젝트 선택)
3. **API 및 서비스** > **라이브러리**로 이동
4. "Maps JavaScript API" 검색 후 **사용** 클릭
5. **API 및 서비스** > **사용자 인증 정보**로 이동
6. **사용자 인증 정보 만들기** > **API 키** 선택
7. 생성된 API 키 복사

#### 2. API 키 제한 설정 (보안 권장)

1. 생성된 API 키 클릭
2. **애플리케이션 제한**:
   - **HTTP 리퍼러(웹사이트)** 선택
   - 도메인 추가: `https://yourdomain.com/*` (프로덕션)
   - 로컬 개발용: `http://localhost:3000/*`
3. **API 제한**:
   - **제한된 키** 선택
   - **Maps JavaScript API**만 선택
4. **저장** 클릭

#### 3. 환경 변수 파일 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가:

```env
NEXT_PUBLIC_GOOGLE_MAP_API_KEY=여기에_발급받은_API_키_입력
```

#### 4. Vercel 배포 시 환경 변수 설정

1. Vercel 대시보드 > 프로젝트 선택
2. **Settings** > **Environment Variables**
3. `NEXT_PUBLIC_GOOGLE_MAP_API_KEY` 추가
4. 값 입력 후 **Save**
5. 재배포

#### 무료 티어 제한

- **Maps JavaScript API**: 월 28,000회 로드 무료
- 일반적인 가족 앱 사용량으로는 충분합니다
- 무료 한도를 초과하면 Google에서 이메일로 알림

#### API 키 없이 사용하기

API 키가 없어도 위치 공유 기능은 작동합니다:
- 좌표는 정상적으로 표시됩니다
- Google 지도 링크를 통해 위치를 확인할 수 있습니다
- 지도는 표시되지 않지만 기능은 사용 가능합니다

### 위치 요청 및 승인 시스템 설정

보안이 강화된 위치 공유 기능을 사용하려면 Supabase 데이터베이스에 테이블을 생성해야 합니다.

#### 1. Supabase SQL Editor에서 스크립트 실행

**단계별 가이드:**

1. **Supabase Dashboard 접속**
   - [Supabase Dashboard](https://app.supabase.com/)에 로그인
   - 사용 중인 프로젝트 선택

2. **SQL Editor 열기**
   - 왼쪽 사이드바에서 **SQL Editor** 메뉴 클릭
   - 또는 상단 메뉴에서 **SQL Editor** 선택

3. **SQL 스크립트 복사**
   - 프로젝트 폴더에서 `supabase_location_requests.sql` 파일 열기
   - 파일 전체 내용 복사 (Ctrl+A → Ctrl+C 또는 Cmd+A → Cmd+C)

4. **SQL 실행**
   - Supabase SQL Editor의 쿼리 입력창에 복사한 내용 붙여넣기 (Ctrl+V 또는 Cmd+V)
   - 우측 하단의 **RUN** 버튼 클릭 (또는 Ctrl+Enter)

5. **실행 결과 확인**
   - 하단에 "Success. No rows returned" 또는 "Success" 메시지가 표시되면 성공
   - 에러가 발생하면 에러 메시지를 확인하고 다시 시도

**참고:**
- 이 스크립트는 테이블, 인덱스, 보안 규칙, Realtime 설정을 모두 생성합니다
- 이미 존재하는 테이블이 있어도 `IF NOT EXISTS`로 안전하게 실행됩니다
- 실행 시간은 약 1-2초 정도 소요됩니다

#### 2. 환경 변수 설정

프로젝트 루트의 `.env.local` 파일에 다음 환경 변수를 추가:

```env
# Supabase 설정 (기존)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# 위치 요청 API용 (서버 사이드 전용)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**중요**: `SUPABASE_SERVICE_ROLE_KEY`는 서버 사이드에서만 사용되며, 클라이언트에 노출되면 안 됩니다.

#### 3. Vercel 배포 시 환경 변수 설정

1. Vercel 대시보드 > 프로젝트 선택
2. **Settings** > **Environment Variables**
3. `SUPABASE_SERVICE_ROLE_KEY` 추가 (서버 사이드 전용)
4. 값 입력 후 **Save**
5. 재배포

#### 위치 요청 기능 사용 방법

1. **위치 요청 보내기**: 위치 섹션에서 "📍 위치 요청" 버튼 클릭
2. **요청 승인/거부**: 받은 요청에 대해 승인 또는 거부 선택
3. **위치 공유**: 승인된 사용자끼리만 서로의 위치를 볼 수 있습니다
4. **보안**: 본인의 위치는 본인만 수정 가능하며, 승인된 관계에서만 읽기 가능

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
