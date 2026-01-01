# Cloudinary & AWS S3 설정 가이드

## 환경 변수 설정

`.env.local` 파일을 프로젝트 루트에 생성하고 다음 환경 변수를 설정하세요:

```env
# Supabase (기존)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_S3_BUCKET_NAME=your_s3_bucket_name
```

## Cloudinary 설정

1. [Cloudinary 대시보드](https://cloudinary.com/console)에 로그인
2. Dashboard에서 다음 정보 확인:
   - Cloud Name
   - API Key
   - API Secret

## AWS S3 설정

1. AWS 콘솔에서 S3 버킷 생성
2. IAM 사용자 생성 및 다음 권한 부여:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject"
         ],
         "Resource": "arn:aws:s3:::your-bucket-name/*"
       }
     ]
   }
   ```
3. Access Key ID와 Secret Access Key 생성

## 업로드 플로우

1. 사용자가 파일 선택
2. 클라이언트에서 리사이징 처리
3. `/api/upload` API Route 호출:
   - Cloudinary에 리사이징된 이미지 업로드 (표시용)
   - AWS S3에 원본 파일 업로드
   - Supabase `memory_vault` 테이블에 메타데이터 저장
4. localStorage에도 저장 (오프라인 지원)

## 주의사항

- 환경 변수는 절대 Git에 커밋하지 마세요
- `.env.local` 파일은 `.gitignore`에 포함되어 있습니다
- 프로덕션 환경에서는 Vercel 등의 플랫폼에서 환경 변수를 설정하세요























