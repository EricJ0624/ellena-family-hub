# S3 버킷 정책 설정 가이드

이 문서는 AWS S3 버킷의 보안 정책 설정 방법을 안내합니다.

## 목적

- 직접 URL 접근 차단
- Presigned URL을 통한 접근만 허용
- 그룹 권한 기반 접근 제어

## AWS 콘솔에서 설정 방법

### 1. S3 버킷 접근

1. AWS 콘솔 로그인
2. S3 서비스 선택
3. 해당 버킷 선택 (환경 변수 `AWS_S3_BUCKET_NAME`에 설정된 버킷)

### 2. 버킷 정책 설정

1. 버킷 선택 → **Permissions** 탭
2. **Bucket policy** 섹션 → **Edit** 클릭
3. 아래 정책을 복사하여 붙여넣기 (버킷 이름과 도메인 수정 필요)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyPublicAccess",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*",
      "Condition": {
        "StringNotEquals": {
          "aws:Referer": "https://your-domain.com"
        }
      }
    },
    {
      "Sid": "AllowPresignedURLAccess",
      "Effect": "Allow",
      "Principal": "*",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*",
      "Condition": {
        "DateGreaterThan": {
          "aws:CurrentTime": "2024-01-01T00:00:00Z"
        }
      }
    }
  ]
}
```

### 3. 정책 수정 사항

**반드시 다음 항목을 수정하세요:**

1. `YOUR_BUCKET_NAME`: 실제 버킷 이름으로 변경
   - 예: `ellena-family-hub-uploads`

2. `https://your-domain.com`: 실제 도메인으로 변경
   - 예: `https://ellena-family-hub.vercel.app`
   - 또는 프로덕션 도메인

### 4. Public Access Block 설정

1. **Permissions** 탭 → **Block public access** 섹션
2. **Edit** 클릭
3. 다음 설정 확인:
   - ✅ Block all public access: **체크 해제** (Presigned URL 사용을 위해)
   - 또는 필요한 항목만 선택적으로 해제

### 5. CORS 설정 (필요한 경우)

1. **Permissions** 탭 → **Cross-origin resource sharing (CORS)** 섹션
2. **Edit** 클릭
3. 다음 CORS 정책 추가:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "https://your-domain.com",
      "https://*.vercel.app"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## 보안 체크리스트

- [ ] 버킷 정책이 적용되었는지 확인
- [ ] Public Access Block 설정 확인
- [ ] CORS 설정 확인 (필요한 경우)
- [ ] Presigned URL이 정상 작동하는지 테스트
- [ ] 직접 URL 접근이 차단되는지 확인

## 테스트 방법

### 1. Presigned URL 테스트

```bash
# Presigned URL 생성 (API 호출)
curl -X POST https://your-domain.com/api/get-upload-url \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName": "test.jpg", "mimeType": "image/jpeg", "fileSize": 1000}'

# 생성된 Presigned URL로 파일 업로드 테스트
```

### 2. 직접 URL 접근 차단 확인

```bash
# 직접 URL 접근 시도 (차단되어야 함)
curl https://YOUR_BUCKET_NAME.s3.REGION.amazonaws.com/path/to/file.jpg

# 403 Forbidden 또는 Access Denied 응답이 와야 함
```

## 주의사항

1. **버킷 정책 수정 시 주의**: 잘못된 정책은 모든 접근을 차단할 수 있습니다.
2. **테스트 환경에서 먼저 확인**: 프로덕션 적용 전 테스트 환경에서 검증하세요.
3. **정기적인 정책 검토**: 보안 정책을 정기적으로 검토하고 업데이트하세요.

## 추가 보안 강화 (선택사항)

### IAM 정책으로 세밀한 제어

버킷 정책 대신 IAM 사용자별 정책을 사용하여 더 세밀한 제어가 가능합니다:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*",
      "Condition": {
        "StringEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    }
  ]
}
```

## 문제 해결

### Presigned URL이 작동하지 않는 경우

1. 버킷 정책의 `AllowPresignedURLAccess` 조건 확인
2. IAM 사용자 권한 확인 (`s3:PutObject`, `s3:GetObject`)
3. 버킷 리전 확인 (환경 변수 `AWS_REGION`과 일치해야 함)

### 직접 URL 접근이 여전히 가능한 경우

1. Public Access Block 설정 확인
2. 버킷 정책의 `DenyPublicAccess` 조건 확인
3. 버킷 ACL 설정 확인 (모든 객체가 private인지 확인)

## 참고 자료

- [AWS S3 버킷 정책 예제](https://docs.aws.amazon.com/AmazonS3/latest/userguide/example-bucket-policies.html)
- [Presigned URL 생성 가이드](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [S3 보안 모범 사례](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)

