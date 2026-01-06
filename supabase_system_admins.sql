-- 시스템 관리자 테이블 생성
-- Supabase SQL Editor에서 실행하세요

-- ============================================
-- 1. system_admins 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS public.system_admins (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  last_access_at TIMESTAMPTZ,
  notes TEXT
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_system_admins_email ON public.system_admins(email);
CREATE INDEX IF NOT EXISTS idx_system_admins_is_active ON public.system_admins(is_active);
CREATE INDEX IF NOT EXISTS idx_system_admins_created_at ON public.system_admins(created_at);

-- ============================================
-- 2. RLS (Row Level Security) 정책 설정
-- ============================================

-- RLS 활성화
ALTER TABLE public.system_admins ENABLE ROW LEVEL SECURITY;

-- 정책: 시스템 관리자는 자신의 정보를 조회할 수 있음
CREATE POLICY "System admins can view their own record"
  ON public.system_admins
  FOR SELECT
  USING (auth.uid() = user_id);

-- 정책: 시스템 관리자는 모든 관리자 목록을 조회할 수 있음
CREATE POLICY "System admins can view all admins"
  ON public.system_admins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = TRUE
    )
  );

-- 정책: 시스템 관리자만 새 관리자를 추가할 수 있음
CREATE POLICY "Only system admins can insert"
  ON public.system_admins
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = TRUE
    )
  );

-- 정책: 시스템 관리자만 관리자 정보를 수정할 수 있음
CREATE POLICY "Only system admins can update"
  ON public.system_admins
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = TRUE
    )
  );

-- 정책: 시스템 관리자만 관리자를 삭제할 수 있음 (자신은 제외)
CREATE POLICY "Only system admins can delete (except self)"
  ON public.system_admins
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = TRUE
    )
    AND auth.uid() != user_id  -- 자신은 삭제 불가
  );

-- ============================================
-- 3. 유틸리티 함수 생성
-- ============================================

-- 시스템 관리자 여부 확인 함수
CREATE OR REPLACE FUNCTION public.is_system_admin(user_id_param UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.system_admins
    WHERE user_id = user_id_param
    AND is_active = TRUE
  );
END;
$$;

-- 시스템 관리자 목록 조회 함수
CREATE OR REPLACE FUNCTION public.get_system_admins()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  last_access_at TIMESTAMPTZ,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 호출자가 시스템 관리자인지 확인
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Only system admins can view admin list';
  END IF;
  
  RETURN QUERY
  SELECT 
    sa.user_id,
    sa.email,
    sa.created_at,
    sa.last_access_at,
    sa.is_active
  FROM public.system_admins sa
  WHERE sa.is_active = TRUE
  ORDER BY sa.created_at DESC;
END;
$$;

-- 시스템 관리자 추가 함수
CREATE OR REPLACE FUNCTION public.add_system_admin(
  target_user_id UUID,
  target_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 호출자가 시스템 관리자인지 확인
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Only system admins can add new admins';
  END IF;
  
  -- 이미 관리자인지 확인
  IF EXISTS (
    SELECT 1 FROM public.system_admins
    WHERE user_id = target_user_id
  ) THEN
    RAISE EXCEPTION 'User is already a system admin';
  END IF;
  
  -- 관리자 추가
  INSERT INTO public.system_admins (user_id, email, created_by)
  VALUES (target_user_id, target_email, auth.uid())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    is_active = TRUE,
    last_access_at = NULL;
  
  RETURN target_user_id;
END;
$$;

-- 시스템 관리자 접근 시간 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_admin_last_access()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.system_admins
  SET last_access_at = NOW()
  WHERE user_id = auth.uid()
  AND is_active = TRUE;
END;
$$;

-- ============================================
-- 4. 초기 관리자 설정 (soungtak@gmail.com)
-- ============================================

-- 초기 관리자 추가 (이메일로 사용자 찾아서 추가)
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- soungtak@gmail.com 사용자 찾기
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'soungtak@gmail.com'
  LIMIT 1;
  
  IF admin_user_id IS NOT NULL THEN
    -- 이미 관리자인지 확인
    IF NOT EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = admin_user_id
    ) THEN
      INSERT INTO public.system_admins (user_id, email, is_active)
      VALUES (admin_user_id, 'soungtak@gmail.com', TRUE)
      ON CONFLICT (user_id) DO NOTHING;
      
      RAISE NOTICE 'Initial admin added: soungtak@gmail.com';
    ELSE
      RAISE NOTICE 'Admin already exists: soungtak@gmail.com';
    END IF;
  ELSE
    RAISE NOTICE 'User not found: soungtak@gmail.com (will be added when user signs up)';
  END IF;
END $$;

-- ============================================
-- 5. 트리거: 사용자 생성 시 관리자 이메일이면 자동 추가
-- ============================================

-- 관리자 이메일 목록 (필요시 수정)
CREATE OR REPLACE FUNCTION public.auto_add_system_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_emails TEXT[] := ARRAY['soungtak@gmail.com'];
  user_email TEXT;
BEGIN
  user_email := NEW.email;
  
  -- 관리자 이메일 목록에 포함되어 있으면 자동 추가
  IF user_email = ANY(admin_emails) THEN
    INSERT INTO public.system_admins (user_id, email, is_active)
    VALUES (NEW.id, user_email, TRUE)
    ON CONFLICT (user_id) DO UPDATE SET
      is_active = TRUE,
      email = user_email;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 트리거 생성 (auth.users에 INSERT 시 실행)
DROP TRIGGER IF EXISTS trigger_auto_add_system_admin ON auth.users;
CREATE TRIGGER trigger_auto_add_system_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_system_admin();

-- ============================================
-- 완료 메시지
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '시스템 관리자 테이블 생성 완료!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '테이블: system_admins';
  RAISE NOTICE '초기 관리자: soungtak@gmail.com';
  RAISE NOTICE 'RLS 정책: 활성화됨';
  RAISE NOTICE '========================================';
END $$;

