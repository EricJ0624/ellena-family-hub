# 사진 업로드/다운로드 수정 사항 정리

> Supabase 점검 후 SQL 적용 → 이후 코드 수정 진행.

---

## 1. 공통

- **용량 제한**: 모든 업로드 **20MB** 통일, 초과 시 거절.
- **browser-image-compression**: 설치 완료. 일반 업로드에서만 사용.
- **DB**: `memory_vault`에 `upload_mode` 컬럼 추가 (`'normal' | 'original'`).
  - SQL 파일: `supabase_add_memory_vault_upload_mode.sql` (Supabase 복구 후 실행)
  - 기존 행: NULL 또는 전부 같은 값(예: `'normal'`)으로 통일해도 문제 없음.

---

## 2. 업로드

| 구분 | 일반 (normal) | 원본 (original) |
|------|----------------|------------------|
| 용량 | 20MB 이하 | 20MB 이하 |
| 처리 | browser-image-compression 압축 후 S3 직접 저장 | 압축 없이 S3 직접 저장 |
| 압축 옵션 | MaxSizeMB: 3, MaxWidthOrHeight: 2560, InitialQuality: 0.9 | - |
| 저장 | S3 1개 (압축본) | S3 1개 (원본) |

- **업로드 시 Cloudinary 사용 안 함.** (Cloudinary는 다운로드/표시 시에만 사용)
- **app 이미지 제거**: app 전용 키/업로드/삭제 로직 전부 제거.

---

## 3. 다운로드/표시

| 구분 | 일반 (normal) | 원본 (original) |
|------|----------------|------------------|
| 소스 | S3 압축본 | S3 원본 |
| 전달 경로 | Cloudinary 변환 → CloudFront 전달 | CloudFront가 S3에서 직접 전달 |
| CloudFront 캐시 | 1년 | 1년 |
| Cloudinary 캐시 | 1달 (이후 삭제) | 해당 없음 |

- Cloudinary: **변환(processing)만** 담당. 변환 결과는 CloudFront로 1회 전달.
- 한 파일당: Cloudinary는 1회 변환·1회 전달 목적. 장기 저장은 CloudFront(1년)만.

---

## 4. 제거할 코드 (app 관련)

- **함수**: `generateAppS3KeyFromMasterKey` 정의 및 모든 사용처 제거.
- **API**
  - `app/api/complete-upload/route.ts`: app 버퍼 생성·app S3 업로드 제거.
  - `app/api/upload/route.ts`: app 이미지 업로드 제거.
  - `app/api/account/delete/route.ts`: app S3 키로 `deleteFromS3(appKey)` 제거.
  - `app/api/admin/groups/delete/route.ts`: app S3 키 삭제 제거.
  - `app/api/photos/delete/route.ts`: app S3 키 삭제 제거.
- **DB**: app 전용 컬럼 없음 → 추가 제거 없음.

---

## 5. 추가/변경할 코드

### DB

- `memory_vault`에 `upload_mode` 컬럼: `'normal' | 'original'` (SQL 파일로 적용)

### API

- **get-upload-url**
  - 용량 제한 20MB로 통일 (기존 50MB/100MB 제거).
  - 필요 시 `upload_mode`(또는 구분자) 받아서 키/메타 구분.
- **complete-upload**
  - Cloudinary 업로드/리사이즈 제거.
  - master 리사이즈·app 이미지 생성·업로드 제거.
  - `upload_mode`, `s3_key` 등으로 DB 삽입. `image_url` = 표시용 URL (일반은 CloudFront→Cloudinary 경로, 원본은 CloudFront S3).
- **upload** (fallback)
  - 20MB 제한, app 업로드 제거, Cloudinary→S3 저장 제거. S3 업로드 + DB 삽입만 유지.

### 클라이언트

- 업로드 플로우
  - 20MB 초과 시 거절.
  - **일반**: 파일 선택 → browser-image-compression 적용 → presigned URL 받아서 **압축된 Blob** PUT → complete-upload 호출 시 `upload_mode: 'normal'`.
  - **원본**: 파일 선택 → presigned URL 받아서 **원본 파일** PUT → complete-upload 호출 시 `upload_mode: 'original'`.
- UI: 일반/원본 선택 (라디오/토글 등).

### 표시 URL

- **원본**: `generatePublicAssetUrl(s3_key)` (CloudFront → S3).
- **일반**: CloudFront URL이 캐시 미스 시 Cloudinary에서 S3 압축본을 fetch해서 변환하도록 연결 (API 302 리다이렉트 또는 Origin 설정).

### 인프라/설정

- CloudFront: 일반 경로 Origin = Cloudinary(또는 API), 원본 경로 Origin = S3. 캐시 TTL **1년**.
- Cloudinary: 변환 결과 캐시 TTL **1달**.

---

## 6. 작업 순서 제안

1. **직접 실행 필요**: Supabase 대시보드 → SQL Editor에서 `supabase_add_memory_vault_upload_mode.sql` 내용 붙여넣기 후 실행. (MCP로 스키마 변경 불가 시)
2. app 관련 코드 제거 (`generateAppS3KeyFromMasterKey`, complete-upload/upload/삭제 API의 app 로직).
3. get-upload-url: 20MB 통일, `upload_mode` 지원.
4. complete-upload: Cloudinary/리사이즈/app 제거, `upload_mode` 반영, 표시 URL 설정.
5. upload (fallback): 20MB, app/Cloudinary 제거.
6. 클라이언트: 20MB 검사, 일반/원본 선택, 일반 시 browser-image-compression 후 presigned PUT.
7. 일반 표시 URL: CloudFront → Cloudinary fetch 연동.
8. CloudFront/Cloudinary 캐시 설정 (1년 / 1달).

---

## 7. 타입 (types/db.ts)

- `memory_vault` Row/Insert/Update에 `upload_mode: 'normal' | 'original' | null` 추가.
