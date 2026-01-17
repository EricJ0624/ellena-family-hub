-- 그룹 저장 용량 한도 추가 (기본 5GB)
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS storage_quota_bytes bigint NOT NULL DEFAULT 5368709120;

COMMENT ON COLUMN public.groups.storage_quota_bytes IS '그룹 저장 용량 한도 (bytes). 기본 5GB';
