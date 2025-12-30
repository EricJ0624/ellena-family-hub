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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
