# 일반 이미지 CloudFront 배포 설정 (당신이 할 일)

일반(normal) 업로드 사진이 **첫 조회만 Cloudinary가 변환**하고, **이후 트래픽은 CloudFront 캐시**에서 나가도록 하는 설정입니다.

---

## 기존 설정: 취소·수정 없음

이미 해 두신 아래 설정은 **그대로 두면 됩니다.** 건드리지 마세요.

| 구분 | 현재 설정 | 할 일 |
|------|-----------|--------|
| **S3 버킷 정책** | CloudFront(OAC)만 GetObject 허용 | **유지** (원본 표시 + Cloudinary fetch 소스로 계속 사용) |
| **CloudFront (기존 배포)** | Origin = S3, Default behavior | **유지** (원본 이미지 + generatePublicAssetUrl용) |
| **Cloudinary** | Fetched URL 허용 또는 Allowed fetch domains = CloudFront | **유지** (/api/photo/serve가 Cloudinary를 호출하고, Cloudinary가 CloudFront URL에서 fetch함) |
| **Vercel** | AWS_CLOUDFRONT_DOMAIN, CLOUDINARY_* 등 | **유지** (아래에서 **추가**만 함) |

**새로 하는 일**: CloudFront에 **Behavior 1개 추가** + Vercel에 **환경 변수 1개 추가**.

---

## 당신이 할 일 (순서대로)

### 1단계: CloudFront에 "이미지 전달용" Behavior 추가

1. **AWS 콘솔** 로그인 → **CloudFront** 메뉴 이동.
2. **기존 배포** 선택  
   (지금 `AWS_CLOUDFRONT_DOMAIN`에 넣은 **도메인**과 같은 배포를 쓸지, **새 배포**를 만들지 결정).

   - **같은 배포에 Behavior만 추가** (권장): 기존 S3 Origin 배포 선택 → 3단계로.  
     이 경우 **2단계 Vercel env**에서 `CLOUDFRONT_IMAGE_DOMAIN`에 **같은 도메인**(`AWS_CLOUDFRONT_DOMAIN`과 동일)을 넣으면 됨.
   - **새 배포로 분리**: CloudFront에서 **Create distribution** → Origin만 우리 앱으로 두고, 아래 Path pattern / 캐시 설정만 적용.  
     이 경우 `CLOUDFRONT_IMAGE_DOMAIN`에는 **새 배포의 도메인**을 넣음.

3. **Behaviors** 탭 → **Create behavior** 클릭.

4. **Path pattern**  
   - `api/photo/serve*` 입력  
   - (Viewer 요청 `https://<cf도메인>/api/photo/serve?key=xxx` 가 이 Behavior로 감.)

5. **Origin**  
   - **Origin and origin groups**에서 **Create origin** 클릭 후:
     - **Origin domain**: 우리 앱 호스트만 입력 (예: `ellena-family-hub.vercel.app`).  
       Vercel이 부여한 `*.vercel.app` 또는 커스텀 도메인. **`https://` 는 넣지 않음.**
     - **Protocol**: HTTPS only.
     - **Name**: 예: `App-Photo-Serve`.
     - **Origin path**: **비움** (비워 두면 `/api/photo/serve` 등 path가 그대로 전달됨).
     - **Enable Origin Shield**: No (해도 됨).
   - 저장 후, 이 Behavior의 **Origin**으로 방금 만든 Origin 선택.

6. **Cache key / Query string**  
   - **Cache policy**: **CachingOptimized** 또는 **Create policy**:
     - **Minimum TTL**: 86400 (1일) 이상, **31536000 (1년)** 권장.
     - **Maximum TTL**: 31536000.
     - **Query strings**: **Whitelist** 선택 후 **Query string names**에 `key` 추가.  
       (같은 key별로 캐시되도록.)
   - **Compress objects automatically**: Yes 권장.

7. **Viewer protocol policy**  
   - Redirect HTTP to HTTPS (또는 기존과 동일하게).

8. **Create behavior** 저장.

9. **동작 확인**  
   - Viewer 요청: `https://<CloudFront 도메인>/api/photo/serve?key=<실제_s3_key>`  
   - CloudFront가 Origin에 보내는 요청: `https://<앱 도메인>/api/photo/serve?key=<같은_key>`  
   - 첫 요청: 캐시 미스 → Origin(우리 앱) → /api/photo/serve → Cloudinary fetch → 200 + 이미지.  
   - 두 번째 요청: 캐시 히트 → CloudFront가 바로 응답 (앱/Cloudinary 미호출).

---

### 2단계: Vercel 환경 변수 추가

1. **Vercel** → 해당 프로젝트 → **Settings** → **Environment Variables**.
2. **Add New**:
   - **Key**: `CLOUDFRONT_IMAGE_DOMAIN` (또는 `AWS_CLOUDFRONT_IMAGE_DOMAIN`)
   - **Value**:  
     - **1단계에서 Behavior 추가한 배포**의 **도메인** (예: `d1bjjw198g1fxc.cloudfront.net`).  
     - **`https://` 없이 호스트만** 입력.
   - **Environment**: Production (및 필요 시 Preview).
3. **Save** 후 **재배포** (또는 다음 배포부터 적용되도록 확인).

---

### 3단계: 동작 확인

1. 앱에서 **일반 업로드** 사진이 보이는 페이지 열기.
2. 브라우저 **개발자 도구** → **Network** 탭.
3. 이미지 요청 URL 확인:
   - **CLOUDFRONT_IMAGE_DOMAIN** 적용 후:  
     첫 요청이 `https://<cf도메인>/api/photo/serve?key=...` 로 가고,  
     같은 사진 다시 로드 시 같은 URL이 **캐시(304 또는 disk cache)** 로 나오면 성공.
4. **같은 이미지**를 여러 번 로드했을 때, 두 번째부터는 CloudFront 캐시에서 나와야 하며,  
   우리 서버(/api/photo/serve)·Cloudinary 호출이 반복되지 않으면 목표 달성.

---

## 요약

| 순서 | 할 일 | 취소/수정 |
|------|--------|-----------|
| 1 | CloudFront에 Path `api/photo/serve*` Behavior 추가, Origin = 우리 앱, 쿼리 `key` 캐시, TTL 1년 | 기존 S3 Origin·다른 설정 **유지** |
| 2 | Vercel에 `CLOUDFRONT_IMAGE_DOMAIN` = 해당 CloudFront 도메인 추가 후 재배포 | 기존 env **유지**, **추가**만 |
| 3 | 앱에서 일반 이미지 로드 → URL이 CloudFront `/api/photo/serve?key=...` 인지, 캐시 동작 확인 | - |

**S3, Cloudinary, 기존 CloudFront(S3 Origin) 설정은 취소하거나 수정하지 않습니다.**
