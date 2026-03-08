-- Sign up 500 해결: profiles 테이블에 updated_at 컬럼 추가
-- 로그 에러: column "updated_at" of relation "profiles" does not exist
-- 적용: Supabase Dashboard → SQL Editor에서 실행

-- updated_at 없을 때만 추가 (이미 있으면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;
