# AWS S3 CORS 설정 가이드

## 문제
Vercel 앱에서 S3 버킷으로 직접 업로드할 때 CORS 오류가 발생합니다.

## 해결 방법

### AWS S3 버킷에 CORS 설정 추가

1. **AWS 콘솔 접속**
   - AWS 콘솔 → S3 → 버킷 선택

2. **CORS 설정**
   - 버킷 선택 → Permissions 탭 → Cross-origin resource sharing (CORS) 섹션
   - "Edit" 버튼 클릭

3. **CORS 구성 추가**
   다음 JSON을 입력하세요:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "https://ellena-family-hub.vercel.app",
            "https://*.vercel.app"
        ],
        "ExposeHeaders": [
            "ETag",
            "x-amz-server-side-encryption",
            "x-amz-request-id",
            "x-amz-id-2"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

4. **설명**
   - `AllowedOrigins`: Vercel 앱 도메인 허용
     - 프로덕션: `https://ellena-family-hub.vercel.app`
     - 프리뷰: `https://*.vercel.app` (모든 프리뷰 배포 허용)
   - `AllowedMethods`: PUT (업로드), GET (다운로드) 등 허용
   - `AllowedHeaders`: 모든 헤더 허용
   - `MaxAgeSeconds`: CORS preflight 캐시 시간 (3000초 = 50분)

5. **Save changes** 클릭

## 추가 확인 사항

### 버킷 정책 확인
버킷이 Public이 아닌 경우, Presigned URL을 사용하므로 추가 정책이 필요하지 않습니다.

### 테스트
CORS 설정 후:
1. 브라우저 캐시 클리어 (또는 시크릿 모드)
2. 사진 업로드 재시도
3. CORS 오류가 사라졌는지 확인

## 참고
- CORS 설정 변경은 즉시 적용됩니다
- 브라우저 캐시로 인해 이전 설정이 남아있을 수 있으므로 캐시 클리어 권장

