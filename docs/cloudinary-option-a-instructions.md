# Cloudinary 옵션 A 적용 후 해야 할 일

Cloudinary는 **변환만** 사용하고, **저장은 S3만** 하도록 수정했습니다.  
표시 트래픽은 **CloudFront**로 나가도록 이미 설정되어 있습니다.

---

## 1. 코드 변경 사항 (이미 적용됨)

- **`app/api/upload/route.ts`**  
  Cloudinary 변환 후 S3 업로드가 끝나면 `deleteFromCloudinary(publicId)` 호출 후, DB에는 `cloudinary_url`/`cloudinary_public_id`를 저장하지 않음(null).
- **`app/api/complete-upload/route.ts`**  
  위와 동일하게 변환 후 S3 저장 → Cloudinary 자산 삭제 → DB에는 Cloudinary 필드 null.

이제 새로 올라오는 사진은 Cloudinary에 남지 않고, S3(마스터 1장 + 표시용 1장)만 저장됩니다.

---

## 2. 당신이 해야 할 일 (상세)

### 2-1. 기존 Cloudinary 자산 일괄 삭제 (1회만)

**의미:** 예전에 업로드된 사진이 Cloudinary에도 저장되어 있다면, 그걸 지워서 Cloudinary 저장/트래픽 비용을 줄입니다.

**조건:**  
- **시스템 관리자**로 로그인된 상태여야 합니다.  
- 배포된 앱 기준 URL이 필요합니다 (예: `https://your-app.vercel.app`).

**방법:**

1. 브라우저에서 **시스템 관리자 계정**으로 로그인합니다.
2. 브라우저 콘솔(F12)을 열거나, Postman/curl 등으로 아래 요청을 보냅니다.

   **POST**  
   `https://your-app.vercel.app/api/admin/cloudinary-cleanup`

   - **헤더:**  
     - `Content-Type: application/json`  
     - 쿠키에 로그인 세션이 포함되어 있어야 합니다 (브라우저에서 같은 도메인으로 요청하면 자동).
   - **Body:**  
     - 비어 있어도 됩니다. `{}` 로 보내도 됩니다.

   **curl 예시 (본인 도메인으로 바꾸세요):**

   ```bash
   curl -X POST "https://your-app.vercel.app/api/admin/cloudinary-cleanup" \
     -H "Content-Type: application/json" \
     -d "{}" \
     --cookie "sb-access-token=YOUR_SESSION_COOKIE_IF_NEEDED"
   ```

   로그인된 브라우저에서 개발자 도구 콘솔에 아래처럼 실행해도 됩니다:

   ```javascript
   fetch('/api/admin/cloudinary-cleanup', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: '{}',
     credentials: 'include',
   })
     .then((r) => r.json())
     .then(console.log)
     .catch(console.error);
   ```

3. **응답 예시**
   - 삭제할 자산이 있을 때:  
     `{ "success": true, "message": "N개 Cloudinary 자산 삭제, N개 레코드 DB 정리 완료", "deleted": N, "updated": N }`
   - 없을 때:  
     `{ "success": true, "message": "삭제할 Cloudinary 자산이 없습니다.", "deleted": 0, "updated": 0 }`
   - 권한 없음:  
     `403` + `시스템 관리자 권한이 필요합니다.`

4. **한 번만** 실행하면 됩니다.  
   같은 API를 여러 번 호출해도, 이미 정리된 레코드는 `cloudinary_public_id`가 null이라 건너뛰므로 안전합니다.

---

### 2-2. 환경 변수 확인 (선택)

- **CloudFront:**  
  이미지 URL이 CloudFront로 나가려면 아래 중 하나가 설정되어 있어야 합니다.  
  - `AWS_CLOUDFRONT_DOMAIN`  
  - `NEXT_PUBLIC_CLOUDFRONT_DOMAIN`  
  (예: `d1234567890.cloudfront.net`)
- **Cloudinary:**  
  변환만 쓰므로 **업로드용** 키가 있으면 됩니다.  
  - `CLOUDINARY_CLOUD_NAME`  
  - `CLOUDINARY_API_KEY`  
  - `CLOUDINARY_API_SECRET`  
  기존과 동일하게 두면 됩니다.
- **S3:**  
  마스터/표시용 저장용 설정은 그대로 두면 됩니다.

---

### 2-3. 동작 확인 (선택)

1. **새 사진 업로드**  
   - 큰 이미지(2560 초과 등) 한 장 업로드 후,  
   - Cloudinary 대시보드에서 해당 폴더에 **새 자산이 생기지 않는지** 확인.
2. **표시**  
   - 앱에서 방금 올린 사진이 **정상 로드**되는지 확인.  
   - 브라우저 네트워크 탭에서 이미지 URL이 **CloudFront 도메인**인지 확인하면 좋습니다.

---

## 3. 요약

| 항목 | 내용 |
|------|------|
| Cloudinary | 변환만 사용, 업로드 직후 자산 삭제 → 저장 없음 |
| S3 | 마스터 1장 + 표시용 1장만 저장 |
| 트래픽 | 표시는 CloudFront URL로 제공 (기존과 동일) |
| **당신이 할 일** | 시스템 관리자로 **POST /api/admin/cloudinary-cleanup** 1회 호출로 기존 Cloudinary 자산 삭제 및 DB 정리 |

위 API 한 번 실행하면, 기존에 Cloudinary에 남아 있던 사진은 삭제되고 DB의 `cloudinary_url`/`cloudinary_public_id`만 null로 정리됩니다.  
이후에는 새 업로드도 옵션 A 플로우만 타므로, Cloudinary에는 아무것도 쌓이지 않습니다.
