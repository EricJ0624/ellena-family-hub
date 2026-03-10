# 인프라 복구 가이드 — S3 → Cloudinary → CloudFront

Vercel Proxy 방식(serve)을 제거하고, **S3 → Cloudinary(변환) → CloudFront(캐시·배포)** 구조로 되돌린 뒤, CloudFront 콘솔에서 해야 할 **삭제/수정** 단계입니다.

---

## 1. CloudFront에서 삭제·수정할 것

### 1.1 Vercel Origin 관련 삭제

| 순서 | 할 일 | 위치 |
|------|--------|------|
| 1 | **Behavior 삭제** | CloudFront → 해당 배포 → **Behaviors** 탭 |
| | Path pattern 이 **`api/photo/serve*`** 인 Behavior를 선택 후 **Delete** | |
| 2 | **Origin 삭제** (선택) | **Origins** 탭 |
| | 이름이 **`App-Photo-Serve`** 이고 Origin domain 이 **`ellena-family-hub.vercel.app`** 인 Origin을 삭제. (위 Behavior를 먼저 삭제해야 Origin을 삭제할 수 있음) | |

### 1.2 이미지 경로용 Behavior·Origin 추가 (Cloudinary)

일반 업로드 이미지 요청이 **CloudFront → Cloudinary** 로 가도록 합니다.

| 순서 | 할 일 | 위치 |
|------|--------|------|
| 1 | **Origin 추가** | **Origins** 탭 → **Create origin** |
| | **Origin domain**: `res.cloudinary.com` (또는 Cloudinary 대시에서 확인한 URL. 예: `{cloud_name}.res.cloudinary.com` 이 아닌 일반적으로 `res.cloudinary.com`) | |
| | **Protocol**: HTTPS only | |
| | **Name**: 예) `Cloudinary-Image` | |
| | **Origin path**: Cloudinary cloud name이 URL에 포함되므로, 여기서는 비우거나 Cloudinary 문서에 맞게 입력. (보통 Origin domain을 `https://res.cloudinary.com/{cloud_name}` 형태로 두려면 Origin path에 `/v1/{cloud_name}` 등이 필요할 수 있음 — Cloudinary 실제 URL 구조 확인) | |
| 2 | **Behavior 추가** | **Behaviors** 탭 → **Create behavior** |
| | **Path pattern**: `image/upload/*` (또는 `image/*` — CloudFront가 받을 경로가 `image/upload/f_auto,q_auto,w_2560/{key}` 이므로) | |
| | **Origin**: 방금 만든 **Cloudinary-Image** 선택 | |
| | **Cache policy**: 쿼리 없이 경로 기반 캐시. TTL 1년 등 적절히 설정. (Cloudinary가 Cache-Control 내려주면 Use origin headers 사용 가능) | |
| | **Origin request policy**: 필요 시 All viewer 또는 최소(경로 전달) | |

**참고**: Proxy가 302하는 URL이 `https://{CLOUDFRONT_DOMAIN}/image/upload/f_auto,q_auto,w_2560/{ENCODED_KEY}` 이므로, CloudFront는 **경로 prefix `image/upload/`** 로 시작하는 요청을 Cloudinary Origin으로 보내야 합니다. Cloudinary 실제 URL은 `https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{public_id}` 형태이므로, **Origin domain**을 `res.cloudinary.com` 으로 두고 **Origin path**에 `/{cloud_name}` 를 넣거나, **Cache behavior**에서 경로를 Cloudinary 형식에 맞게 매핑해야 할 수 있습니다. (Cloudinary 대시·문서에서 “Delivery URL” 확인 후, CloudFront Origin path / path pattern 을 그에 맞게 조정하세요.)

### 1.3 Origin request policy 정리 (선택)

| 순서 | 할 일 |
|------|--------|
| 1 | **VercelPhotoServeOriginRequest** 같은, Vercel Origin용으로 만든 **Origin request policy**는 더 이상 쓰이지 않음. |
| | CloudFront 정책 목록에서 삭제해도 됨. (다른 Behavior에서 참조 중이면 먼저 해당 Behavior를 수정한 뒤 삭제) |

---

## 2. Vercel 환경 변수 정리

| 변수 | 조치 |
|------|------|
| **AWS_CLOUDFRONT_DOMAIN** 또는 **NEXT_PUBLIC_CLOUDFRONT_DOMAIN** | **유지**. Proxy가 302할 CloudFront 호스트로 사용. |
| **CLOUDFRONT_IMAGE_DOMAIN** 또는 **AWS_CLOUDFRONT_IMAGE_DOMAIN** | **삭제 가능**. 이전에 Vercel Origin(serve) 경로용으로 쓰던 값. 지금은 proxy가 위 CloudFront 도메인 하나만 쓰므로 불필요. |
| **CLOUDINARY_***, **AWS_*** (S3 등) | **유지**. 다른 기능(업로드, 원본 표시 등)에서 사용. |

---

## 3. Cloudinary 설정 확인

| 항목 | 확인 내용 |
|------|-----------|
| **Allowed fetch domains** | CloudFront 도메인(예: `d1bjjw498g4ixc.cloudfront.net`) 또는 S3 소스 URL에 쓰는 CloudFront 도메인이 허용돼 있는지. |
| **이미지 URL 구조** | 앱이 302하는 경로 `image/upload/f_auto,q_auto,w_2560/{key}` 가 Cloudinary **upload** 자산 경로와 맞는지. (소스가 S3이고 **fetch**로 가져오는 구조라면, CloudFront 경로를 `image/fetch/...` 로 바꾸거나, Cloudinary에서 fetch 소스 URL을 허용하는지 확인.) |

---

## 4. S3 / 기타

| 항목 | 조치 |
|------|------|
| **S3 버킷** | 기존처럼 CloudFront(OAC)로 읽기만 허용. **변경 없음.** |
| **임시 S3 버킷** | 오늘 테스트로 만든 버킷이 있다면, 사용하지 않으면 삭제. (비용 없음에 가깝지만 정리용) |

---

## 5. 작업 순서 요약

1. CloudFront **Behaviors** → **`api/photo/serve*`** Behavior **삭제**
2. CloudFront **Origins** → **App-Photo-Serve**(Vercel) Origin **삭제**
3. CloudFront **Origins** → Cloudinary용 Origin **추가** (domain 등 Cloudinary URL에 맞게)
4. CloudFront **Behaviors** → **`image/upload/*`** (또는 적절한 path) Behavior **추가**, Origin = Cloudinary
5. (선택) **VercelPhotoServeOriginRequest** 등 사용 안 하는 Origin request policy **삭제**
6. Vercel **Environment Variables** → **CLOUDFRONT_IMAGE_DOMAIN** (또는 **AWS_CLOUDFRONT_IMAGE_DOMAIN**) **삭제**
7. 배포 반영 대기 후, 앱에서 일반 업로드 이미지 로드해 보기

---

*코드 반영: /api/photo/serve 삭제, /api/photo/proxy는 CloudFront URL로 302만 수행.*
