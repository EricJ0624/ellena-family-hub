# 일반 이미지 CloudFront 배포 설정 (당신이 할 일)

일반(normal) 업로드 사진을 **첫 조회만 Cloudinary가 변환**하고, **이후 트래픽은 CloudFront 캐시**에서 나가도록 하는 설정입니다.

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

### 1단계: CloudFront에 “이미지 전달용” Behavior 추가

1. **AWS 콘솔** 로그인 → **CloudFront** 메뉴 이동.
2. **기존 배포** 선택  
   (지금 `AWS_CLOUDFRONT_DOMAIN` / `NEXT_PUBLIC_CLOUDFRONT_DOMAIN`에 넣은 **도메인**과 같은 배포).
3. **Behaviors** 탭 → **Create behavior** 클릭.
4. 아래처럼 입력 후 저장.

   | 항목 | 값 |
   |------|-----|
   | **Path pattern** | `img*` |
   | **Origin and origin groups** | **Create origin** 클릭해서 새 Origin 추가 (아래 5번 참고) |
   | **Viewer protocol policy** | Redirect HTTP to HTTPS (또는 기존 정책 유지) |
   | **Allowed HTTP methods** | GET, HEAD, OPTIONS |
   | **Cache policy** | CachingOptimized 또는 **Custom**: |
   | ↳ **Minimum TTL** | 86400 (1일) 이상 권장, **31536000 (1년)** 권장 |
   | ↳ **Maximum TTL** | 31536000 |
   | ↳ **Query strings** | **Yes** 선택 후 **Query string names**에 `key` 입력 (캐시 키에 `key` 포함) |
   | **Compress objects automatically** | Yes 권장 |

5. **Create origin** 시 입력값:
   - **Origin domain**: 우리 앱 도메인 (예: `ellena-family-hub.vercel.app` 또는 커스텀 도메인).  
     **반드시 HTTPS.** `https://` 는 넣지 말고 **호스트만** (예: `ellena-family-hub.vercel.app`).
   - **Protocol**: HTTPS only.
   - **Name**: 예: `App-Photo-Serve`.
   - **Origin path**: 비워 둠 (비어 있으면 요청 path가 그대로 전달됨).
   - **Enable Origin Shield**: No (해도 됨).

6. **Path pattern** `img*` 의 Origin으로 방금 만든 **App-Photo-Serve** 선택.
7. **Cache key and origin requests**:
   - **Cache policy**에서 **Query strings - Yes**, **Query string names**에 `key` 넣어서  
     `https://<cf도메인>/img?key=xxx` 별로 캐시되게 함.
8. **Create behavior** 저장.

9. **동작 확인**  
   - Viewer 요청: `https://<CloudFront 도메인>/img?key=<s3_key>`  
   - CloudFront가 **Origin 요청**을 보낼 때:  
     `https://<앱 도메인>/api/photo/serve?key=<s3_key>`  
   로 가야 함.  
   - Path가 `/img` 로 들어오면 Origin 요청 path를 `/api/photo/serve` 로 바꿔야 하는데,  
     CloudFront 기본 동작은 path를 그대로 전달하므로 **앱 도메인을 “Custom origin”으로 두고**,  
     **Origin path**를 비워 두면 `/img?key=xxx` 가 그대로 앱으로 감.  
     → 우리 앱에는 `/img` 라우트가 없으므로, **Path pattern을 `/img*`로 두고 Origin path를 `/api/photo/serve`로** 하거나,  
     **Viewer가 `/api/photo/serve?key=xxx`를 요청하도록** 하면 됨.

**정리 (권장):**  
- **Path pattern**: `img*`  
- **Origin domain**: `우리앱.vercel.app`  
- **Origin path**: 비움  
- 그러면 Viewer 요청 `https://cf도메인/img?key=xxx` → Origin 요청 `https://앱/img?key=xxx` 가 됨.  
  우리 앱에 `GET /img` 는 없으므로 **404**가 난다.

**올바른 방법:**  
CloudFront에서 **Origin path**를 `/api/photo/serve`로 두면,  
Viewer: `https://cf도메인/img?key=xxx` → Origin: `https://앱/api/photo/serve?key=xxx`.  
하지만 **path가 바뀜**: Viewer의 `/img` 가 Origin에서 `/api/photo/serve`로.  
CloudFront의 “Origin path”는 **prefix**로 붙는 것이라: Origin path = `/api/photo/serve` 이면  
Origin 요청 = `https://앱/api/photo/serve/img?key=xxx` 가 될 수 있음 (CloudFront 문서 확인 필요).

가장 확실한 방법: **Viewer가 직접 `/api/photo/serve`를 요청하게** 하면 됨.  
즉 프록시가 302 to `https://<cf도메인>/api/photo/serve?key=xxx` 로 보내고,  
CloudFront Path pattern을 `api/photo/serve*` 또는 `api*` 로 두고,  
Origin = 앱, Origin path = 비움.  
그러면 Viewer: `https://cf도메인/api/photo/serve?key=xxx` → Origin: `https://앱/api/photo/serve?key=xxx`.  
완벽함.

그래서 코드에서 프록시가 302 to `https://${normalized}/img?key=...` 가 아니라  
`https://${normalized}/api/photo/serve?key=...` 로 보내는 게 CloudFront 설정이 단순해짐.  
그럼 Path pattern을 `api/photo/serve*` 로 두면 됨.

코드를 수정하자: 프록시에서 CloudFront URL을 `/api/photo/serve?key=...` 로 보내도록.
</think>
CloudFront는 path를 그대로 Origin으로 전달하므로, 프록시가 `/api/photo/serve?key=...`로 302하도록 바꾸면 설정이 단순해집니다.
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
StrReplace