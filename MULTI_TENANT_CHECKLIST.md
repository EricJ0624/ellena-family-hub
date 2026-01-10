# Multi-tenant 아키텍처 확인 체크리스트

Multi-tenant 아키텍처 구현 후 Vercel, Cloudinary, AWS S3에서 확인해야 할 사항들을 정리했습니다.

## ✅ 1. Vercel 환경 변수 확인

### 필수 환경 변수

Vercel Dashboard → Project Settings → Environment Variables에서 다음 변수들이 모두 설정되어 있는지 확인:

```env
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # API 라우트에서 사용

# Cloudinary (선택, 권장)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# AWS S3 (선택, 권장)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_S3_BUCKET_NAME=your_s3_bucket_name
```

### 확인 사항

- [ ] 모든 환경 변수가 Production, Preview, Development 환경에 올바르게 설정되어 있는지 확인
- [ ] 환경 변수 이름에 오타가 없는지 확인 (대소문자 구분)
- [ ] `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있는지 확인 (API 라우트에서 필수)
- [ ] Vercel 배포 후 로그에서 환경 변수 관련 에러가 없는지 확인

### 환경 변수 확인 방법

Vercel CLI 사용:
```bash
vercel env ls
```

또는 Vercel Dashboard에서 직접 확인:
1. Project → Settings → Environment Variables
2. 각 환경별로 변수 확인

---

## ✅ 2. Cloudinary 설정 확인

### 폴더 구조 확인

Multi-tenant 아키텍처 구현 후, Cloudinary의 폴더 구조는 다음과 같아야 합니다:

**기존 구조 (사용자별):**
```
family-memories/
  └── {userId}/
      └── files...
```

**새로운 구조 (그룹별):**
```
family-memories/
  └── {groupId}/
      └── {userId}/
          └── files...
```

### 확인 사항

- [ ] Cloudinary Dashboard → Media Library에서 폴더 구조 확인
- [ ] 새로 업로드된 파일이 `family-memories/{groupId}/{userId}/` 경로에 저장되는지 확인
- [ ] 메타데이터에 `groupId`와 `userId`가 포함되는지 확인

### Cloudinary 메타데이터 확인 방법

1. Cloudinary Dashboard 접속
2. Media Library에서 업로드된 파일 선택
3. Details 탭에서 Context 확인:
   - `groupId`: 그룹 ID
   - `userId`: 업로드한 사용자 ID

### Cloudinary 설정 검증

**업로드된 파일 확인:**
```bash
# Cloudinary API를 통한 파일 확인 (예시)
curl -X GET "https://api.cloudinary.com/v1_1/{cloud_name}/resources/image" \
  -u "{api_key}:{api_secret}"
```

**폴더 구조 확인:**
- Cloudinary Dashboard → Media Library
- 폴더별로 파일 확인
- `family-memories/{groupId}/` 폴더가 생성되는지 확인

---

## ✅ 3. AWS S3 설정 확인

### S3 버킷 폴더 구조 확인

Multi-tenant 아키텍처 구현 후, S3 버킷의 폴더 구조는 다음과 같아야 합니다:

**기존 구조 (사용자별):**
```
originals/
  └── photos/
      └── {year}/
          └── {month}/
              └── {userId}/
                  └── files...
```

**새로운 구조 (그룹별):**
```
originals/
  └── groups/
      └── {groupId}/
          └── photos/
              └── {year}/
                  └── {month}/
                      └── {userId}/
                          └── files...
```

### 확인 사항

- [ ] AWS S3 콘솔에서 버킷 접근
- [ ] `originals/groups/{groupId}/` 경로가 생성되는지 확인
- [ ] 업로드된 파일이 올바른 경로에 저장되는지 확인
- [ ] 파일 메타데이터에 `groupId`와 `userId`가 포함되는지 확인

### S3 파일 메타데이터 확인 방법

1. AWS S3 콘솔 접속
2. 버킷 선택
3. 파일 선택 → Properties 탭
4. Metadata 섹션에서 확인:
   - `groupId`: 그룹 ID
   - `userId`: 업로드한 사용자 ID

### S3 버킷 정책 확인

**기본 버킷 정책 확인 사항:**

- [ ] 모든 파일이 `private` ACL로 설정되어 있는지 확인
- [ ] Public Access Block이 적절히 설정되어 있는지 확인
- [ ] Presigned URL 생성이 정상 작동하는지 확인
- [ ] 직접 URL 접근이 차단되는지 확인

**버킷 정책 예시:**
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
    }
  ]
}
```

### S3 폴더 구조 검증

**AWS CLI를 사용한 확인:**
```bash
# 그룹별 폴더 구조 확인
aws s3 ls s3://YOUR_BUCKET_NAME/originals/groups/ --recursive

# 특정 그룹의 파일 확인
aws s3 ls s3://YOUR_BUCKET_NAME/originals/groups/{groupId}/photos/ --recursive
```

**파일 메타데이터 확인:**
```bash
# 특정 파일의 메타데이터 확인
aws s3api head-object \
  --bucket YOUR_BUCKET_NAME \
  --key originals/groups/{groupId}/photos/2024/01/{userId}/file.jpg
```

---

## ✅ 4. 애플리케이션 레벨 확인

### API 엔드포인트 테스트

**1. 업로드 API 테스트 (groupId 포함):**
```bash
curl -X POST https://your-domain.com/api/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "originalData": "base64...",
    "fileName": "test.jpg",
    "mimeType": "image/jpeg",
    "groupId": "group-id-here"
  }'
```

**예상 응답:**
- `groupId`가 없으면: `400 Bad Request` (groupId는 필수입니다)
- 권한이 없으면: `403 Forbidden` (그룹 접근 권한이 없습니다)
- 성공: `200 OK` (cloudinaryUrl, s3Url, group_id 포함)

**2. 데이터 조회 API 테스트:**
```bash
# memory_vault 조회 시 group_id 필터 확인
curl -X GET "https://your-domain.com/api/memory-vault?groupId=group-id-here" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 데이터베이스 확인

**Supabase SQL Editor에서 확인:**

```sql
-- memory_vault 테이블에 group_id 컬럼 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'memory_vault'
AND column_name = 'group_id';

-- group_id로 필터링되는지 확인
SELECT id, uploader_id, group_id, created_at
FROM memory_vault
WHERE group_id = 'your-group-id'
LIMIT 10;

-- RLS 정책 확인
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'memory_vault';
```

**확인 사항:**
- [ ] 모든 테이블에 `group_id` 컬럼이 추가되었는지 확인
- [ ] RLS 정책이 올바르게 설정되었는지 확인
- [ ] 다른 그룹의 데이터를 조회할 수 없는지 확인

---

## ✅ 5. 보안 검증

### 그룹 간 데이터 격리 확인

**1. 그룹 A 사용자로 로그인:**
- 그룹 A의 데이터만 조회되는지 확인
- 그룹 B의 데이터는 조회되지 않는지 확인

**2. 그룹 B 사용자로 로그인:**
- 그룹 B의 데이터만 조회되는지 확인
- 그룹 A의 데이터는 조회되지 않는지 확인

**3. API 권한 검증:**
- 다른 그룹의 `groupId`로 요청 시 `403 Forbidden` 반환되는지 확인
- 유효하지 않은 `groupId`로 요청 시 적절한 에러 메시지 반환되는지 확인

### RLS 정책 검증

```sql
-- RLS 정책 테스트 (Supabase SQL Editor에서)
-- 1. 그룹 멤버로 시뮬레이션
SET ROLE authenticated;
SET request.jwt.claim.sub = 'user-id-here';

-- 2. 데이터 조회 테스트
SELECT * FROM memory_vault;

-- 3. 다른 그룹의 데이터는 조회되지 않아야 함
SELECT * FROM memory_vault WHERE group_id = 'other-group-id';
-- 결과: 빈 결과셋 (RLS 정책에 의해 필터링됨)
```

---

## ✅ 6. 성능 최적화 확인

### 인덱스 확인

**Supabase SQL Editor에서 인덱스 확인:**

```sql
-- group_id 인덱스 확인
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('memory_vault', 'family_tasks', 'family_events', 'family_messages', 'location_requests')
AND indexname LIKE '%group_id%';

-- 복합 인덱스 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE '%group_created%' OR indexname LIKE '%group_date%';
```

**확인 사항:**
- [ ] 모든 테이블에 `group_id` 인덱스가 생성되었는지 확인
- [ ] 복합 인덱스 (`group_id, created_at` 등)가 생성되었는지 확인
- [ ] 쿼리 성능이 저하되지 않았는지 확인

### 쿼리 성능 테스트

```sql
-- 쿼리 실행 계획 확인 (EXPLAIN ANALYZE)
EXPLAIN ANALYZE
SELECT * FROM memory_vault
WHERE group_id = 'your-group-id'
ORDER BY created_at DESC
LIMIT 100;

-- 인덱스가 사용되는지 확인 (Index Scan 또는 Index Only Scan)
```

---

## ✅ 7. 마이그레이션 확인

### 기존 데이터 처리

**기존 데이터가 있는 경우:**

```sql
-- 1. group_id가 NULL인 데이터 확인
SELECT COUNT(*) FROM memory_vault WHERE group_id IS NULL;
SELECT COUNT(*) FROM family_tasks WHERE group_id IS NULL;
SELECT COUNT(*) FROM family_events WHERE group_id IS NULL;

-- 2. 기존 데이터에 group_id 설정 (예시)
-- 주의: 실제 마이그레이션 전에 백업 필수!
UPDATE memory_vault
SET group_id = (
  SELECT group_id 
  FROM memberships 
  WHERE user_id = memory_vault.uploader_id 
  LIMIT 1
)
WHERE group_id IS NULL;

-- 3. group_id를 NOT NULL로 변경 (마이그레이션 완료 후)
ALTER TABLE memory_vault ALTER COLUMN group_id SET NOT NULL;
```

**확인 사항:**
- [ ] 기존 데이터에 `group_id`가 설정되었는지 확인
- [ ] 모든 레코드에 유효한 `group_id`가 있는지 확인
- [ ] 마이그레이션 후 데이터 무결성이 유지되는지 확인

---

## ✅ 8. 배포 후 검증

### Vercel 배포 확인

- [ ] 배포가 성공적으로 완료되었는지 확인
- [ ] 빌드 로그에 에러가 없는지 확인
- [ ] 환경 변수가 올바르게 주입되었는지 확인
- [ ] 프로덕션 환경에서 애플리케이션이 정상 작동하는지 확인

### 통합 테스트

**1. 전체 업로드 플로우 테스트:**
1. 사용자 로그인
2. 그룹 선택
3. 파일 업로드
4. Cloudinary에 올바른 경로로 업로드되는지 확인
5. S3에 올바른 경로로 업로드되는지 확인
6. Supabase에 `group_id`와 함께 저장되는지 확인

**2. 데이터 조회 테스트:**
1. 그룹 A 사용자로 로그인
2. 그룹 A의 데이터만 조회되는지 확인
3. 그룹 B 사용자로 로그인
4. 그룹 B의 데이터만 조회되는지 확인

**3. 권한 검증 테스트:**
1. 그룹 멤버가 아닌 사용자로 로그인
2. 다른 그룹의 데이터 접근 시도
3. `403 Forbidden` 반환되는지 확인

---

## 📝 체크리스트 요약

### Vercel
- [ ] 모든 환경 변수 설정 확인
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 설정 확인
- [ ] 배포 성공 확인

### Cloudinary
- [ ] 폴더 구조 변경 확인 (`family-memories/{groupId}/{userId}/`)
- [ ] 메타데이터에 `groupId` 포함 확인
- [ ] 새 업로드가 올바른 경로에 저장되는지 확인

### AWS S3
- [ ] 폴더 구조 변경 확인 (`originals/groups/{groupId}/photos/...`)
- [ ] 파일 메타데이터에 `groupId` 포함 확인
- [ ] 버킷 정책이 올바르게 설정되었는지 확인
- [ ] Public Access Block 설정 확인

### 데이터베이스
- [ ] 모든 테이블에 `group_id` 컬럼 추가 확인
- [ ] RLS 정책이 올바르게 설정되었는지 확인
- [ ] 인덱스가 생성되었는지 확인
- [ ] 그룹 간 데이터 격리 확인

### 애플리케이션
- [ ] API 엔드포인트에 `groupId` 검증 추가 확인
- [ ] 업로드 시 `groupId` 전달 확인
- [ ] 데이터 조회 시 `group_id` 필터 적용 확인
- [ ] 권한 검증이 올바르게 작동하는지 확인

---

## 🔧 문제 해결

### 문제: Cloudinary/S3에 파일이 올바른 경로에 저장되지 않음

**해결 방법:**
1. `app/api/upload/route.ts`에서 `uploadToCloudinaryWithGroup`와 `uploadToS3WithGroup` 함수 사용 확인
2. `groupId`가 올바르게 전달되는지 확인
3. 업로드 로그 확인

### 문제: 다른 그룹의 데이터가 조회됨

**해결 방법:**
1. RLS 정책 확인
2. 쿼리에 `.eq('group_id', currentGroupId)` 필터 추가 확인
3. `currentGroupId`가 올바르게 설정되는지 확인

### 문제: 환경 변수 에러

**해결 방법:**
1. Vercel Dashboard에서 환경 변수 재확인
2. 환경 변수 이름 대소문자 확인
3. Vercel 재배포

---

## 📚 참고 자료

- [Vercel 환경 변수 설정 가이드](https://vercel.com/docs/concepts/projects/environment-variables)
- [Cloudinary 폴더 구조 문서](https://cloudinary.com/documentation/upload_images#folder_parameter)
- [AWS S3 버킷 정책 가이드](S3_BUCKET_POLICY_GUIDE.md)
- [Supabase RLS 정책 가이드](https://supabase.com/docs/guides/auth/row-level-security)
