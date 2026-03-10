# 일반 사진 업로드 표시 안 되는 문제 — 수정·확인 작업 기록

일반(normal) 업로드 사진이 앨범/액자에서 "이미지 로드 실패"로 나오고, CloudFront `/api/photo/serve` 요청이 502로 실패했던 이슈에 대한 **수정 사항**, **확인한 작업**, **현재 인프라 설정**을 기록해 둡니다. 추후 동일 작업·확인을 반복하지 않도록 참고용으로 사용하세요.

---

## 1. 수정한 코드/설정 (이미 반영됨)

### 1.1 key 이중 인코딩 보정 (proxy / serve)

- **파일**: `app/api/photo/proxy/route.ts`, `app/api/photo/serve/route.ts`
- **내용**: `request.nextUrl.searchParams.get('key')` 로 받은 값에 대해, `%`가 없어질 때까지 `decodeURIComponent(key)` 반복 후, 리다이렉트/URL 생성 시 `encodeURIComponent(key)` **한 번만** 사용해 이중 인코딩 제거.
- **커밋**: `fix(photo): key 이중 인코딩 보정 - proxy/serve에서 decode 후 한 번만 인코딩`

### 1.2 AlbumContext — proxy URL을 stable로 포함

- **파일**: `app/contexts/AlbumContext.tsx`
- **내용**: "stable" URL 판단 시 `http://`, `https://` 뿐 아니라 **`/api/photo/proxy`** 도 포함.
  - 적용 위치: `persistAlbumOnly`(stableOnly), `loadAlbum` 실패 시 stableLocal, `localOnly` 병합 시 필터.
- **커밋**: `fix(album): 일반 업로드(proxy URL)를 stable로 포함 - persist/localOnly 일치`

---

## 2. 확인한 작업 (재확인 불필요 시 이 섹션 참고)

### 2.1 클라이언트

- 표시용 URL은 **서버(DB/API)에서 받은 값만** 사용. `/api/photo/proxy?key=...` 를 클라이언트에서 새로 조합하지 않음.
- URL을 `encodeURIComponent` 등으로 한 번 더 감싸지 않음.
- 대시보드, TitlePage(액자), Memories, AlbumContext에서 "stable"에 `/api/photo/proxy` 포함 여부 확인됨.

### 2.2 Network / 응답

- `proxy?key=...` → **302** 정상.
- `serve?key=...` (CloudFront) → **502 Bad Gateway**, **X-Cache: Error from cloudfront**, **Content-Type: text/html**.
- 요청 URL의 `key`는 **한 번만 인코딩** (`originals%2Fgroups%2F...`) 상태로 확인됨. 이중 인코딩 아님.

### 2.3 Vercel 로그

- `/api/photo/proxy` 요청은 로그에 기록됨 (302).
- **`/api/photo/serve` 요청은 Vercel 로그에 전혀 기록되지 않음** → CloudFront가 Origin(Vercel)으로 요청을 보내지 못하거나, Vercel 엣지에서 거절하는 상황으로 추정.

### 2.4 CloudFront 설정

- **Behaviors (2개)**
  - **Precedence 0**: Path pattern `api/photo/serve*` → Origin `App-Photo-Serve` (Vercel), Cache policy `UseOriginCacheControlHeaders-QueryStrings`, Origin request policy `VercelPhotoServeOriginRequest`.
  - **Precedence 1**: Path pattern `Default (*)` → Origin S3 (`ellena-family-hub.s3.ap-south-...`).
- **Origin `App-Photo-Serve`**
  - Origin domain: `ellena-family-hub.vercel.app`
  - Protocol: HTTPS only, Port 443, Minimum SSL: TLSv1.2
  - **Add custom header**: **Host** 헤더는 CloudFront에서 허용되지 않음 ("The parameter HeaderName : Host is not allowed").
- **Origin request policy `VercelPhotoServeOriginRequest`**
  - Headers: **All viewer headers except** → **Host** 제외.
  - Query strings: **All**.
  - Cookies: **None**.

---

## 3. 현재 인프라 설정 요약 (기억용)

### 3.1 아키텍처 원칙 (변경하지 않음)

- **Cloudinary**: 변환 및 전송 **1회만** (캐시 미스 시).
- **CloudFront**: 그 결과를 캐시하고, 이후 트래픽은 CloudFront가 캐시·배포.

### 3.2 Cloudinary

- **역할**: 일반 업로드 이미지에 대해 fetch 후 변환(w_2560, f_auto, q_auto 등) 1회 수행.
- **설정**: Fetched URL 허용 또는 **Allowed fetch domains**에 CloudFront 도메인 포함. CloudFront URL에서 fetch 가능하도록 설정.
- **환경 변수 (Vercel)**: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

### 3.3 S3

- **역할**: 일반/원본 업로드 파일 저장. CloudFront(OAC)를 통해 읽기.
- **버킷 정책**: CloudFront OAC만 GetObject 허용. S3 직접 URL은 401.
- **환경 변수 (Vercel)**: `AWS_S3_BUCKET_NAME`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

### 3.4 CloudFront

- **배포 도메인**: 예) `d1bjjw498g4ixc.cloudfront.net` (실제 값은 Vercel env 기준).
- **Behaviors**
  - `api/photo/serve*` → Origin **Vercel** (`ellena-family-hub.vercel.app`), Origin request policy `VercelPhotoServeOriginRequest`, Cache policy에서 쿼리 `key` 포함.
  - `Default (*)` → Origin **S3** (기존 앱/원본 이미지용).
- **Origin `App-Photo-Serve`**: 도메인 `ellena-family-hub.vercel.app`, HTTPS 443, TLSv1.2. Host 커스텀 헤더는 설정 불가.

### 3.5 Vercel

- **환경 변수**
  - `AWS_CLOUDFRONT_DOMAIN` 또는 `NEXT_PUBLIC_CLOUDFRONT_DOMAIN`: CloudFront 도메인 (호스트만).
  - `CLOUDFRONT_IMAGE_DOMAIN` 또는 `AWS_CLOUDFRONT_IMAGE_DOMAIN`: 위와 동일 CloudFront 도메인 (proxy가 302로 보낼 대상).
  - `CLOUDINARY_*`, `AWS_*` (S3/CloudFront 관련).
- **흐름**
  - 브라우저 → `GET /api/photo/proxy?key=...` → 302 → `https://<CloudFront>/api/photo/serve?key=...`
  - CloudFront 캐시 미스 시 → CloudFront가 Origin으로 `GET /api/photo/serve?key=...` 요청 → **현재 여기서 502 발생, Vercel 로그에 요청 미기록.**

---

## 4. 남은 이슈 및 선택지

### 4.1 원인 정리

- **502** = CloudFront가 Origin(Vercel)에서 에러 응답을 받은 상태.
- Vercel 로그에 `/api/photo/serve` 가 안 찍히는 것으로 보아, **CloudFront → Vercel 요청이 Host 등 이유로 거절되거나 연결 자체가 실패**하는 것으로 추정.

### 4.2 해결 선택지 (구조 유지 vs 단순화)

| 방법 | 설명 | 비고 |
|------|------|------|
| **Lambda@Edge (origin-request)** | us-east-1에 Lambda 생성 후, Origin request에서 **Host** 헤더를 `ellena-family-hub.vercel.app` 로 설정. CloudFront Behavior의 Origin request에 해당 Lambda 버전 연결. | Cloudinary 1회 + CloudFront 캐시 구조 유지. 리전·Lambda 관리 필요. |
| **Proxy를 Vercel 직접 URL로 302** | `CLOUDFRONT_IMAGE_DOMAIN`이 있어도 proxy가 302 목적지를 **CloudFront가 아닌** `https://ellena-family-hub.vercel.app/api/photo/serve?key=...` 로 변경. | Host 문제 없음. **CloudFront 캐시 미사용** (매 요청 Vercel → Cloudinary). |

---

## 5. 관련 문서

- [CLOUDFRONT_IMAGE_DELIVERY_SETUP.md](./CLOUDFRONT_IMAGE_DELIVERY_SETUP.md) — CloudFront Behavior 추가·Vercel env 설정
- [S3_BUCKET_POLICY_FOR_CLOUDFRONT.md](./S3_BUCKET_POLICY_FOR_CLOUDFRONT.md) — S3 버킷 정책·일반 업로드 401
- [PHOTO_UPLOAD_DOWNLOAD_CHANGES.md](./PHOTO_UPLOAD_DOWNLOAD_CHANGES.md) — 업로드/다운로드·표시 경로 개요

---

*마지막 업데이트: 2026-03-08 — 일반 업로드 502 원인 추적 및 설정 확인까지 반영.*
