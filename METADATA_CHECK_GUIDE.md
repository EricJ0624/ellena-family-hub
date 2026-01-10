# Cloudinary & AWS S3 메타데이터 확인 가이드

Cloudinary와 AWS S3에서 업로드된 파일의 메타데이터에 `groupId`가 포함되어 있는지 확인하는 방법입니다.

## 📸 1. Cloudinary에서 메타데이터 확인

### 방법 1: Cloudinary Dashboard에서 확인

1. **Cloudinary Dashboard 접속**
   - https://cloudinary.com/console 접속
   - 로그인

2. **Media Library 열기**
   - 왼쪽 메뉴에서 "Media Library" 클릭

3. **파일 선택**
   - 업로드된 파일 클릭

4. **Details 탭 확인**
   - 파일 상세 정보 창에서 "Details" 탭 클릭
   - **Context** 섹션에서 확인:
     - `groupId`: 그룹 ID
     - `userId`: 업로드한 사용자 ID

**확인 경로:**
```
Media Library → 파일 선택 → Details 탭 → Context 섹션
```

### 방법 2: Cloudinary API로 확인

**Cloudinary Admin API 사용:**

```bash
# 파일 정보 조회 (Public ID 필요)
curl -X GET \
  "https://api.cloudinary.com/v1_1/{cloud_name}/resources/image/upload/{public_id}" \
  -u "{api_key}:{api_secret}"

# 응답 예시:
# {
#   "public_id": "family-memories/group-id-123/user-id-456/photo",
#   "context": {
#     "groupId": "group-id-123",
#     "userId": "user-id-456"
#   },
#   ...
# }
```

**JavaScript/Node.js에서 확인:**

```javascript
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 파일 정보 조회
cloudinary.api.resource('family-memories/group-id-123/user-id-456/photo', 
  function(error, result) {
    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Context:', result.context);
      // {
      //   groupId: 'group-id-123',
      //   userId: 'user-id-456'
      // }
    }
  }
);
```

### 방법 3: 코드에서 확인 (개발 중)

**Cloudinary Admin API를 사용한 확인:**

```typescript
import { v2 as cloudinary } from 'cloudinary';

async function checkCloudinaryMetadata(publicId: string) {
  try {
    const result = await cloudinary.api.resource(publicId);
    console.log('Cloudinary Context:', result.context);
    console.log('GroupId:', result.context?.groupId);
    console.log('UserId:', result.context?.userId);
    
    return {
      groupId: result.context?.groupId,
      userId: result.context?.userId
    };
  } catch (error) {
    console.error('Error checking metadata:', error);
    return null;
  }
}
```

---

## ☁️ 2. AWS S3에서 메타데이터 확인

### 방법 1: AWS S3 콘솔에서 확인

1. **AWS S3 콘솔 접속**
   - https://s3.console.aws.amazon.com/ 접속
   - 로그인

2. **버킷 선택**
   - 버킷 목록에서 업로드된 파일이 있는 버킷 선택

3. **파일 선택**
   - `originals/groups/{groupId}/photos/...` 경로에서 파일 찾기
   - 파일 클릭

4. **Properties 탭 확인**
   - 파일 상세 정보에서 **Properties** 탭 클릭
   - **Metadata** 섹션에서 확인:
     - `groupId`: 그룹 ID
     - `userId`: 업로드한 사용자 ID

**확인 경로:**
```
S3 Console → Bucket 선택 → 파일 선택 → Properties 탭 → Metadata 섹션
```

### 방법 2: AWS CLI로 확인

**head-object 명령어 사용:**

```bash
# 파일 메타데이터 조회
aws s3api head-object \
  --bucket YOUR_BUCKET_NAME \
  --key "originals/groups/{groupId}/photos/2024/01/{userId}/file.jpg"

# 응답 예시:
# {
#   "Metadata": {
#     "groupId": "group-id-123",
#     "userId": "user-id-456"
#   },
#   "ContentType": "image/jpeg",
#   "ContentLength": 12345,
#   ...
# }
```

**특정 키의 메타데이터만 조회:**

```bash
# 메타데이터만 출력 (jq 사용)
aws s3api head-object \
  --bucket YOUR_BUCKET_NAME \
  --key "originals/groups/{groupId}/photos/2024/01/{userId}/file.jpg" \
  --query 'Metadata' \
  --output json

# 출력:
# {
#   "groupId": "group-id-123",
#   "userId": "user-id-456"
# }
```

### 방법 3: AWS SDK로 확인 (Node.js)

```javascript
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function checkS3Metadata(bucket, key) {
  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key
    });
    
    const response = await s3Client.send(command);
    console.log('S3 Metadata:', response.Metadata);
    console.log('GroupId:', response.Metadata?.groupId);
    console.log('UserId:', response.Metadata?.userId);
    
    return {
      groupId: response.Metadata?.groupId,
      userId: response.Metadata?.userId
    };
  } catch (error) {
    console.error('Error checking metadata:', error);
    return null;
  }
}

// 사용 예시
checkS3Metadata(
  'your-bucket-name',
  'originals/groups/group-id-123/photos/2024/01/user-id-456/file.jpg'
);
```

### 방법 4: 코드에서 확인 (개발 중)

**lib/api-helpers.ts에 헬퍼 함수 추가 (예시):**

```typescript
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

/**
 * S3 파일 메타데이터 확인
 */
export async function checkS3FileMetadata(s3Key: string): Promise<{
  groupId?: string;
  userId?: string;
} | null> {
  try {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('AWS_S3_BUCKET_NAME 환경 변수가 설정되지 않았습니다.');
    }

    const s3Client = getS3ClientInstance();
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: s3Key
    });

    const response = await s3Client.send(command);
    
    return {
      groupId: response.Metadata?.groupId,
      userId: response.Metadata?.userId
    };
  } catch (error) {
    console.error('S3 메타데이터 확인 오류:', error);
    return null;
  }
}
```

---

## 🔍 3. 실제 확인 방법 (단계별)

### Step 1: 파일 업로드

1. 애플리케이션에서 파일 업로드
2. `groupId`를 포함하여 업로드 (Multi-tenant 아키텍처)
3. 업로드 성공 후 `s3_key` 또는 `cloudinary_public_id` 확인

### Step 2: Cloudinary 확인

**Dashboard에서:**
1. Cloudinary Dashboard → Media Library
2. 폴더 구조 확인: `family-memories/{groupId}/{userId}/`
3. 파일 선택 → Details → Context 확인

**API로 확인:**
```bash
# Public ID를 사용하여 확인
curl -X GET \
  "https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/resources/image/upload/family-memories/GROUP_ID/USER_ID/FILE_NAME" \
  -u "YOUR_API_KEY:YOUR_API_SECRET" | jq '.context'
```

### Step 3: AWS S3 확인

**콘솔에서:**
1. AWS S3 Console → Bucket 선택
2. 경로 확인: `originals/groups/{groupId}/photos/...`
3. 파일 선택 → Properties → Metadata 확인

**CLI로 확인:**
```bash
# S3 Key를 사용하여 확인
aws s3api head-object \
  --bucket YOUR_BUCKET_NAME \
  --key "originals/groups/GROUP_ID/photos/2024/01/USER_ID/FILE_NAME" \
  --query 'Metadata' \
  --output json
```

---

## 📝 4. 코드에서 메타데이터 확인 (개발/디버깅)

### API 엔드포인트 추가 (선택사항)

파일 메타데이터를 확인하는 API 엔드포인트를 추가할 수 있습니다:

```typescript
// app/api/check-metadata/route.ts (예시)
import { NextRequest, NextResponse } from 'next/server';
import { checkS3FileMetadata } from '@/lib/api-helpers';
import { v2 as cloudinary } from 'cloudinary';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type'); // 's3' or 'cloudinary'
  const identifier = searchParams.get('id'); // s3_key or cloudinary_public_id

  if (!type || !identifier) {
    return NextResponse.json(
      { error: 'type와 id 파라미터가 필요합니다.' },
      { status: 400 }
    );
  }

  try {
    if (type === 's3') {
      // S3 메타데이터 확인
      const metadata = await checkS3FileMetadata(identifier);
      return NextResponse.json({ 
        source: 's3',
        key: identifier,
        metadata 
      });
    } else if (type === 'cloudinary') {
      // Cloudinary 메타데이터 확인
      const result = await cloudinary.api.resource(identifier);
      return NextResponse.json({
        source: 'cloudinary',
        publicId: identifier,
        metadata: result.context
      });
    } else {
      return NextResponse.json(
        { error: '유효하지 않은 type입니다. (s3 또는 cloudinary)' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '메타데이터 확인 실패' },
      { status: 500 }
    );
  }
}
```

**사용 예시:**
```bash
# S3 메타데이터 확인
curl "https://your-domain.com/api/check-metadata?type=s3&id=originals/groups/group-id/photos/2024/01/user-id/file.jpg"

# Cloudinary 메타데이터 확인
curl "https://your-domain.com/api/check-metadata?type=cloudinary&id=family-memories/group-id/user-id/file"
```

---

## ✅ 5. 확인 체크리스트

### Cloudinary
- [ ] Dashboard에서 파일 선택 후 Details 탭 확인
- [ ] Context 섹션에 `groupId`와 `userId` 포함 확인
- [ ] 폴더 구조가 `family-memories/{groupId}/{userId}/`인지 확인

### AWS S3
- [ ] S3 콘솔에서 파일 선택 후 Properties 탭 확인
- [ ] Metadata 섹션에 `groupId`와 `userId` 포함 확인
- [ ] 파일 경로가 `originals/groups/{groupId}/photos/...`인지 확인

### 코드 레벨
- [ ] `app/api/upload/route.ts`에서 `uploadToCloudinaryWithGroup` 사용 확인
- [ ] `app/api/upload/route.ts`에서 `uploadToS3WithGroup` 사용 확인
- [ ] 업로드 시 `groupId`가 전달되는지 확인

---

## 🔧 문제 해결

### 문제: Cloudinary Context에 groupId가 없음

**원인:**
- `uploadToCloudinaryWithGroup` 함수를 사용하지 않았을 수 있음
- `groupId`가 전달되지 않았을 수 있음

**해결:**
1. `app/api/upload/route.ts` 확인
2. `uploadToCloudinaryWithGroup` 함수 사용 확인
3. `groupId` 파라미터 전달 확인

### 문제: S3 Metadata에 groupId가 없음

**원인:**
- `uploadToS3WithGroup` 함수를 사용하지 않았을 수 있음
- `groupId`가 전달되지 않았을 수 있음

**해결:**
1. `app/api/upload/route.ts` 확인
2. `uploadToS3WithGroup` 함수 사용 확인
3. `groupId` 파라미터 전달 확인

### 문제: 메타데이터 확인이 안 됨

**원인:**
- 파일이 아직 업로드되지 않았을 수 있음
- 잘못된 키/Public ID를 사용했을 수 있음

**해결:**
1. 업로드가 성공했는지 확인
2. 올바른 S3 Key 또는 Cloudinary Public ID 사용 확인
3. 권한 확인 (API 키/시크릿)

---

## 📚 참고 자료

- [Cloudinary Admin API 문서](https://cloudinary.com/documentation/admin_api)
- [AWS S3 HeadObject API 문서](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html)
- [Cloudinary Context 메타데이터](https://cloudinary.com/documentation/image_upload_api_reference#context_parameter)
- [AWS S3 메타데이터 설정](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html)
