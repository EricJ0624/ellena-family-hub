-- memory_vault 테이블: Cloudinary (1차) + AWS S3 (원본 저장)
-- Supabase SQL Editor에서 실행하세요
-- 먼저 check_memory_vault_structure.sql로 현재 구조를 확인한 후 실행하세요

-- ============================================
-- Cloudinary (1차 업로드) + AWS S3 (원본 저장) 지원 컬럼 추가
-- ============================================

-- Cloudinary URL (1차 업로드: 변환/최적화된 이미지/동영상)
-- 앱에서 표시할 때 사용 (썸네일, 리사이즈 등)
ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS cloudinary_url TEXT;

-- AWS S3 원본 파일 URL (모든 원본은 S3에 저장)
-- 원본 다운로드 시 사용
ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS s3_original_url TEXT;

-- 파일 타입 (photo 또는 video)
ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'photo' 
  CHECK (file_type IN ('photo', 'video'));

-- 원본 파일 크기 (bytes) - S3에 저장된 원본 파일 크기
ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS original_file_size BIGINT;

-- Cloudinary Public ID (삭제할 때 사용)
ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;

-- AWS S3 Key/Path (원본 파일 삭제할 때 사용)
-- 예: "originals/photos/2024/01/abc123.jpg"
ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS s3_key TEXT;

-- MIME 타입 (원본 파일)
-- 예: "image/jpeg", "video/mp4"
ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- 원본 파일명 (업로드 시 파일명)
ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- ============================================
-- 업로드 플로우 설명
-- ============================================
/*
1. 사용자가 파일 업로드
2. 파일을 Cloudinary에 업로드 (1차: 변환/최적화)
   → cloudinary_url 생성
   → cloudinary_public_id 저장
3. 원본 파일을 AWS S3에 업로드
   → s3_original_url 생성
   → s3_key 저장
4. Supabase 테이블에 정보 저장
*/

-- ============================================
-- 사용 예시
-- ============================================
/*
INSERT INTO public.memory_vault (
  uploader_id,
  cloudinary_url,         -- Cloudinary 변환 URL (1차 업로드)
  s3_original_url,        -- AWS S3 원본 URL (모든 원본)
  file_type,              -- 'photo' 또는 'video'
  original_file_size,     -- 원본 파일 크기 (bytes)
  cloudinary_public_id,   -- Cloudinary 삭제용
  s3_key,                 -- S3 원본 삭제용
  mime_type,              -- MIME 타입
  original_filename,      -- 원본 파일명
  caption                 -- 설명 (기존 컬럼)
) VALUES (
  auth.uid(),
  'https://res.cloudinary.com/.../image/upload/v123/photo.jpg',  -- Cloudinary (표시용)
  'https://bucket.s3.amazonaws.com/originals/photos/2024/01/abc123.jpg',  -- S3 (원본)
  'photo',
  2048000,  -- 원본 파일 크기
  'photos/abc123',
  'originals/photos/2024/01/abc123.jpg',
  'image/jpeg',
  'family-photo.jpg',
  '가족 사진'
);
*/

