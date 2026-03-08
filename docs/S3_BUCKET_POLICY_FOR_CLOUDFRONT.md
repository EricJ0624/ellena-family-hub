# S3 버킷 정책 — CloudFront가 이미지 읽기 (일반 업로드 401 해결)

Cloudinary가 CloudFront URL로 이미지를 가져올 수 있도록, **S3 버킷에서 CloudFront만 읽을 수 있게** 허용하는 정책입니다.

---

## 네가 할 일 (3단계)

### 1. AWS 콘솔 로그인
- https://console.aws.amazon.com 접속 후 로그인

### 2. S3 버킷 정책 넣기
1. 상단 검색창에 **S3** 입력 → **S3** 메뉴 클릭
2. 왼쪽 **Buckets** → **사진 저장하는 버킷** 이름 클릭  
   (`.env.local`의 `AWS_S3_BUCKET_NAME` 값이 버킷 이름)
3. 위쪽 탭 **Permissions** 클릭
4. 아래로 내려가 **Bucket policy** → **Edit** 클릭
5. 아래 **정책 JSON** 전체를 복사해서 **기존 내용을 지우고 붙여넣기**  
   (이미 다른 정책이 있으면, `Statement` 배열 안에 아래 `{ ... }` 한 블록만 **추가**하고 콤마 맞추기)
6. **세 군데만 수정**:
   - `YOUR_BUCKET_NAME` → **버킷 이름** (2번에서 연 그 버킷)
   - `ACCOUNT_ID` → **12자리 AWS 계정 ID** (콘솔 오른쪽 위 계정 메뉴 → Account ID)
   - `DISTRIBUTION_ID` → **CloudFront Distribution ID** (CloudFront 메뉴 → 해당 배포의 ID, 예: E2ABCD1234XYZ)
7. **Save changes** 클릭

### 3. CloudFront 확인
1. 상단 검색창에 **CloudFront** 입력 → **CloudFront** 메뉴
2. 이미지 URL에 쓰는 배포 선택 (Domain name이 `.env`의 `AWS_CLOUDFRONT_DOMAIN` 또는 `NEXT_PUBLIC_CLOUDFRONT_DOMAIN`와 같음)
3. **Behaviors** 탭 → **Restrict viewer access** 가 **No** 인지 확인 (이미 No면 끝)

---

## 정책 JSON (복사용)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontRead",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/originals/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

**바꿀 곳**
- `YOUR_BUCKET_NAME` → S3 버킷 이름
- `ACCOUNT_ID` → AWS 계정 ID (12자리 숫자)
- `DISTRIBUTION_ID` → CloudFront Distribution ID (예: E2XXXX...)

---

## 적용 후 확인

앱에서 **일반 업로드** 사진이 보이는 페이지 새로고침 → 이미지가 정상 표시되면 성공.

---

## 이미지 깨짐 진단 (업로드 vs 표시 구분)

**업로드가 안 된 건지, 표시만 안 되는 건지** 확인하려면 진단 API를 쓰면 됩니다.

1. Supabase 대시보드 → **Table Editor** → **memory_vault** → 깨져 보이는 사진 행에서 **s3_key** 값 복사
2. 브라우저에서 열기:  
   `https://<내-앱-도메인>/api/photo/diagnose?key=<복사한_s3_key>`
3. 응답 예:
   - `s3Exists: false` → **업로드 실패** (S3에 파일 없음)
   - `s3Exists: true`, `cloudfrontStatus: 401 또는 403` → **표시 실패** (S3 버킷 정책/OAC 점검)
   - `s3Exists: true`, `cloudfrontStatus: 200` → 업로드·표시 모두 정상 (캐시/다른 원인 가능)

가족앨범에서 이미지 로드에 실패하면 **「진단」** 링크가 나오도록 해 두었습니다. 그 링크를 눌러도 같은 진단 결과를 볼 수 있습니다.

---

## ✅ OAC 사용 중일 때 — 반드시 "Copy policy" 쓰기

Origin이 **Origin access control (OAC)** 로 되어 있으면, S3 버킷 정책은 **CloudFront가 만들어 준 그대로** 써야 합니다.  
지금 쓰는 정책이 **distribution ARN** 기준인데, OAC는 **OAC ARN** 기준 정책을 요구할 수 있어서 401/403이 날 수 있습니다.

**해결 (한 번만 하면 됨)**  
1. CloudFront → 해당 배포 → **Origins** 탭 → S3 오리진 **이름 클릭** (또는 Edit)  
2. **Edit origin** 화면에서 파란 박스 **"You must allow access to CloudFront using this policy statement"** 아래 **Copy policy** 버튼 클릭  
3. S3 → 버킷 **ellena-family-hub** → **Permissions** → **Bucket policy** → **Edit**  
4. **Copy policy**로 복사한 내용으로 **기존 정책 전체를 갈아끼우기** (또는 Statement만 맞게 합치기)  
5. **Save changes**

이렇게 하면 OAC에 맞는 정책이 들어가서 401이 사라질 가능성이 높습니다.

---

## 왜 안 되나? — 원인 확인 (401 나올 때)

정책이 이미 있는데도 401이 나면, 아래를 **순서대로** 확인하세요.

### 1. CloudFront Origin이 OAI인지 OAC인지 확인 (가장 흔한 원인)

지금 버킷 정책은 **OAC(Origin Access Control)** 용입니다.  
CloudFront가 **예전 방식 OAI(Origin Access Identity)** 로 되어 있으면, S3가 요청을 거절해서 403/401이 날 수 있습니다.

**확인 방법**
1. AWS 콘솔 → **CloudFront** → 배포 **EVD96PC2U4UUD** 클릭
2. **Origins** 탭 → S3 오리진 한 개 클릭 (이름 클릭)
3. **Origin access** 항목 확인:
   - **"Origin access control settings (recommended)"** → OAC. 지금 정책이 맞음. 다음 단계로.
   - **"Legacy access identities"** 또는 **"Origin access identity"** → OAI. 이면 아래로.

**OAI로 되어 있을 때 해결**
- 같은 Origins 화면에서 **Edit** → **Origin access**를 **Create control setting** 또는 **Origin access control** 로 바꾸고 저장.  
  (기존 OAI를 쓰는 대신, 새 OAC를 만들고 그걸 쓰게 바꾸면 됩니다.)
- 또는, OAI를 계속 쓰려면 버킷 정책을 **OAI용**으로 바꿔야 합니다.  
  CloudFront Origins에 보이는 **Origin access identity** ID(예: E1234ABCD)를 보고,  
  Principal을 `"AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity E1234ABCD"` 형태로 넣는 정책으로 교체해야 합니다.

### 2. CloudFront URL 직접 열어보기

1. DB 또는 앱에서 **일반 업로드** 이미지 하나의 **s3_key** 를 확인 (예: `originals/groups/xxx/photos/.../xxx.jpg`)
2. 브라우저 주소창에 입력:  
   `https://<CloudFront 도메인>/<s3_key>`  
   (예: `https://d1bjjw498g4ixc.cloudfront.net/originals/groups/.../xxx.jpg`)  
   `.env.local`의 `AWS_CLOUDFRONT_DOMAIN` 또는 `NEXT_PUBLIC_CLOUDFRONT_DOMAIN` 에서 도메인 확인.
3. 결과:
   - **이미지가 보이거나 200** → CloudFront/S3는 정상. 401은 Cloudinary 쪽이나 다른 경로 문제.
   - **403 또는 401** → CloudFront 또는 S3에서 거부 중. 1번(OAC/OAI) 다시 확인.

### 3. 앱이 쓰는 CloudFront가 이 배포가 맞는지 확인

- 배포된 앱(Vercel 등)이 쓰는 **환경 변수**에  
  `AWS_CLOUDFRONT_DOMAIN` / `NEXT_PUBLIC_CLOUDFRONT_DOMAIN` 가 뭘로 되어 있는지 확인.
- 그 **도메인**이 CloudFront 배포 **EVD96PC2U4UUD** 의 **Domain name**과 **완전히 같아야** 합니다.  
  다르면(다른 배포를 가리키면) 그 배포의 Origin/정책을 봐야 합니다.
