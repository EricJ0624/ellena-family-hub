-- 가족(Group) 단위 권한 관리 시스템을 위한 Supabase 테이블 및 보안 규칙
-- Supabase SQL Editor에서 실행하세요
-- 전체 스크립트를 처음부터 끝까지 한 번에 실행하세요!

-- ============================================
-- 1. groups 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS public.groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  invite_code_expires_at TIMESTAMPTZ, -- 초대 코드 만료 시간 (NULL이면 영구 유효)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_groups_owner_id ON public.groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON public.groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_groups_created_at ON public.groups(created_at);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code_expires_at ON public.groups(invite_code_expires_at) WHERE invite_code_expires_at IS NOT NULL;

-- ============================================
-- 2. memberships 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS public.memberships (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, group_id)
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_group_id ON public.memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_memberships_role ON public.memberships(role);
CREATE INDEX IF NOT EXISTS idx_memberships_joined_at ON public.memberships(joined_at);

-- ============================================
-- 3. 트리거 함수 생성
-- ============================================

-- groups용 updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_groups_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- 4. 트리거 생성
-- ============================================

DROP TRIGGER IF EXISTS update_groups_updated_at ON public.groups;
CREATE TRIGGER update_groups_updated_at 
  BEFORE UPDATE ON public.groups
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_groups_updated_at_column();

-- ============================================
-- 5. RLS 활성화
-- ============================================

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. groups 보안 규칙 (RLS)
-- ============================================

DROP POLICY IF EXISTS "그룹 읽기 - 멤버만" ON public.groups;
CREATE POLICY "그룹 읽기 - 멤버만" ON public.groups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.group_id = groups.id
      AND memberships.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "그룹 작성 - 인증된 사용자" ON public.groups;
CREATE POLICY "그룹 작성 - 인증된 사용자" ON public.groups
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    auth.uid() = owner_id
  );

DROP POLICY IF EXISTS "그룹 수정 - ADMIN만" ON public.groups;
CREATE POLICY "그룹 수정 - ADMIN만" ON public.groups
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.group_id = groups.id
      AND memberships.user_id = auth.uid()
      AND memberships.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.group_id = groups.id
      AND memberships.user_id = auth.uid()
      AND memberships.role = 'ADMIN'
    )
  );

DROP POLICY IF EXISTS "그룹 삭제 - 소유자만" ON public.groups;
CREATE POLICY "그룹 삭제 - 소유자만" ON public.groups
  FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================
-- 7. memberships 보안 규칙 (RLS)
-- ============================================

DROP POLICY IF EXISTS "멤버십 읽기 - 그룹 멤버만" ON public.memberships;
CREATE POLICY "멤버십 읽기 - 그룹 멤버만" ON public.memberships
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.group_id = memberships.group_id
      AND m.user_id = auth.uid()
    )
  );

-- 작성: ADMIN 권한을 가진 사용자만 멤버 초대 가능 (또는 초대 코드를 통한 자동 가입)
-- 초대 코드를 통한 가입은 별도 함수로 처리하는 것을 권장
DROP POLICY IF EXISTS "멤버십 작성 - ADMIN만" ON public.memberships;
CREATE POLICY "멤버십 작성 - ADMIN만" ON public.memberships
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.group_id = memberships.group_id
      AND m.user_id = auth.uid()
      AND m.role = 'ADMIN'
    )
    OR
    -- 자기 자신을 추가하는 경우 (초대 코드를 통한 가입)
    auth.uid() = memberships.user_id
  );

DROP POLICY IF EXISTS "멤버십 수정 - ADMIN만" ON public.memberships;
CREATE POLICY "멤버십 수정 - ADMIN만" ON public.memberships
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.group_id = memberships.group_id
      AND m.user_id = auth.uid()
      AND m.role = 'ADMIN'
    )
    AND auth.uid() != memberships.user_id  -- 자신의 역할은 변경 불가
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.group_id = memberships.group_id
      AND m.user_id = auth.uid()
      AND m.role = 'ADMIN'
    )
    AND auth.uid() != memberships.user_id  -- 자신의 역할은 변경 불가
  );

DROP POLICY IF EXISTS "멤버십 삭제 - ADMIN 또는 본인" ON public.memberships;
CREATE POLICY "멤버십 삭제 - ADMIN 또는 본인" ON public.memberships
  FOR DELETE
  USING (
    -- ADMIN이 다른 멤버를 추방하는 경우
    (
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = memberships.group_id
        AND m.user_id = auth.uid()
        AND m.role = 'ADMIN'
      )
      AND auth.uid() != memberships.user_id
    )
    OR
    -- 본인이 그룹을 나가는 경우
    auth.uid() = memberships.user_id
  );

-- ============================================
-- 8. 그룹 생성 시 소유자를 자동으로 ADMIN으로 추가하는 함수
-- ============================================

CREATE OR REPLACE FUNCTION public.add_group_owner_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 그룹 소유자를 자동으로 ADMIN으로 추가
  INSERT INTO public.memberships (user_id, group_id, role)
  VALUES (NEW.owner_id, NEW.id, 'ADMIN')
  ON CONFLICT (user_id, group_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS add_group_owner_as_admin_trigger ON public.groups;
CREATE TRIGGER add_group_owner_as_admin_trigger
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.add_group_owner_as_admin();

-- ============================================
-- 9. Realtime 활성화 (선택사항)
-- ============================================

-- 그룹 및 멤버십 변경사항을 실시간으로 감지하려면 활성화 (이미 추가된 경우 스킵)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'groups') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'memberships') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.memberships;
  END IF;
END $$;

-- ============================================
-- 10. 유용한 뷰 생성 (선택사항)
-- ============================================

-- 그룹과 멤버 정보를 함께 조회하는 뷰
CREATE OR REPLACE VIEW public.group_members_view AS
SELECT 
  g.id AS group_id,
  g.name AS group_name,
  g.invite_code,
  g.owner_id,
  g.avatar_url AS group_avatar_url,
  g.created_at AS group_created_at,
  m.user_id,
  m.role,
  m.joined_at,
  p.email,
  p.nickname,
  p.avatar_url AS user_avatar_url
FROM public.groups g
INNER JOIN public.memberships m ON g.id = m.group_id
LEFT JOIN public.profiles p ON m.user_id = p.id;

-- 뷰에 대한 RLS 정책
ALTER VIEW public.group_members_view SET (security_invoker = true);

-- ============================================
-- 11. 초대 코드 생성 함수 (12자: 대문자+소문자+숫자)
-- ============================================

CREATE OR REPLACE FUNCTION public.generate_invite_code_12()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
  alphabet TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  i INTEGER;
  random_char TEXT;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..12 LOOP
      random_char := substr(alphabet, floor(random() * length(alphabet) + 1)::integer, 1);
      code := code || random_char;
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.groups WHERE invite_code = code) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN code;
END;
$$;

-- 최초 그룹 생성 시 사용 (온보딩 RPC)
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN public.generate_invite_code_12();
END;
$$;

-- 갱신 시 사용 (refresh_invite_code에서 호출)
CREATE OR REPLACE FUNCTION public.generate_secure_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN public.generate_invite_code_12();
END;
$$;

-- 초대 코드 만료 확인 함수
CREATE OR REPLACE FUNCTION public.is_invite_code_valid(invite_code_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  expires_at TIMESTAMPTZ;
BEGIN
  SELECT invite_code_expires_at INTO expires_at
  FROM public.groups
  WHERE invite_code = invite_code_param;
  
  -- 만료 시간이 없으면 영구 유효 (기존 그룹 호환)
  IF expires_at IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- 만료 시간이 지났으면 무효
  RETURN expires_at > NOW();
END;
$$;

-- 초대 코드 갱신 함수 (만료 시간 설정)
CREATE OR REPLACE FUNCTION public.refresh_invite_code(
  group_id_param UUID,
  expires_in_days INTEGER DEFAULT 30
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_code TEXT;
  new_expires_at TIMESTAMPTZ;
BEGIN
  -- 권한 확인: ADMIN만 초대 코드 갱신 가능
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE group_id = group_id_param
    AND user_id = auth.uid()
    AND role = 'ADMIN'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = group_id_param
    AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only ADMIN can refresh invite code';
  END IF;
  
  -- 새로운 보안 강화 코드 생성
  new_code := public.generate_secure_invite_code();
  new_expires_at := NOW() + (expires_in_days || INTERVAL '1 day');
  
  -- 그룹의 초대 코드 및 만료 시간 업데이트
  UPDATE public.groups
  SET 
    invite_code = new_code,
    invite_code_expires_at = new_expires_at,
    updated_at = NOW()
  WHERE id = group_id_param;
  
  RETURN new_code;
END;
$$;

-- ============================================
-- 12. 초대 코드로 그룹 가입 함수 (보안 강화: 만료 확인 추가)
-- ============================================

CREATE OR REPLACE FUNCTION public.join_group_by_invite_code(invite_code_param TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_group_id UUID;
BEGIN
  -- 초대 코드 유효성 확인 (만료 시간 체크)
  IF NOT public.is_invite_code_valid(invite_code_param) THEN
    RAISE EXCEPTION 'Invite code has expired';
  END IF;
  
  -- 초대 코드로 그룹 찾기
  SELECT id INTO target_group_id
  FROM public.groups
  WHERE invite_code = invite_code_param;
  
  -- 그룹이 없으면 에러
  IF target_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  
  -- 이미 멤버인지 확인
  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid()
    AND group_id = target_group_id
  ) THEN
    RAISE EXCEPTION 'Already a member of this group';
  END IF;
  
  -- 멤버로 추가
  INSERT INTO public.memberships (user_id, group_id, role)
  VALUES (auth.uid(), target_group_id, 'MEMBER')
  ON CONFLICT (user_id, group_id) DO NOTHING;
  
  RETURN target_group_id;
END;
$$;

-- ============================================
-- 13. 기존 그룹의 invite_code_expires_at 컬럼 마이그레이션 (NULL로 유지 = 영구 유효)
-- ============================================

-- 기존 그룹은 invite_code_expires_at이 NULL이므로 영구 유효로 유지됨
-- 새로운 그룹 생성 시에는 refresh_invite_code 함수를 사용하여 만료 시간 설정 가능

-- ============================================
-- 완료 메시지
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '그룹 및 멤버십 테이블 생성 완료!';
  RAISE NOTICE 'RLS 정책이 활성화되었습니다.';
  RAISE NOTICE 'Realtime이 활성화되었습니다.';
  RAISE NOTICE '보안 강화: 초대 코드 TTL 및 nanoid 스타일 코드 생성 함수가 추가되었습니다.';
  RAISE NOTICE '기존 그룹은 invite_code_expires_at이 NULL이므로 영구 유효로 유지됩니다.';
END $$;

