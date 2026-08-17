-- 시스템 관리자 회원/그룹 정지
-- 로그인 차단(Auth ban) 없음. 데이터 삭제 없음.
-- 문의는 moderation_threads / moderation_messages 에 쌓임.

-- ============================================
-- 1. 문의 실
-- ============================================

CREATE TABLE IF NOT EXISTS public.moderation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('user_in_group', 'group')),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT moderation_threads_scope_user CHECK (
    (scope = 'user_in_group' AND user_id IS NOT NULL)
    OR (scope = 'group' AND user_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS moderation_threads_user_unique
  ON public.moderation_threads (group_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS moderation_threads_group_unique
  ON public.moderation_threads (group_id)
  WHERE user_id IS NULL;

COMMENT ON TABLE public.moderation_threads IS '정지/해제 안내 문의 실. user_in_group=특정 회원, group=그룹 전원.';

CREATE TABLE IF NOT EXISTS public.moderation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.moderation_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_kind TEXT NOT NULL CHECK (author_kind IN ('system_admin', 'member')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_messages_thread_created
  ON public.moderation_messages (thread_id, created_at);

COMMENT ON TABLE public.moderation_messages IS '정지 안내 문의 메시지. 시스템 관리자와 대상 회원이 오감.';

-- ============================================
-- 2. 정지 상태
-- ============================================

CREATE TABLE IF NOT EXISTS public.account_suspensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.moderation_threads(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('user_in_group', 'group')),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  suspended_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  unsuspended_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  suspended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsuspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT account_suspensions_scope_user CHECK (
    (scope = 'user_in_group' AND user_id IS NOT NULL)
    OR (scope = 'group' AND user_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS account_suspensions_active_user
  ON public.account_suspensions (group_id, user_id)
  WHERE is_active AND scope = 'user_in_group';

CREATE UNIQUE INDEX IF NOT EXISTS account_suspensions_active_group
  ON public.account_suspensions (group_id)
  WHERE is_active AND scope = 'group';

CREATE INDEX IF NOT EXISTS idx_account_suspensions_user
  ON public.account_suspensions (user_id, is_active)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_account_suspensions_group
  ON public.account_suspensions (group_id, is_active);

COMMENT ON TABLE public.account_suspensions IS '활성 정지. 해제 시 is_active=false. 가족 데이터는 삭제하지 않음.';

-- ============================================
-- 3. 조회 헬퍼 (2단계에서 가드가 사용)
-- ============================================

CREATE OR REPLACE FUNCTION public.is_group_suspended(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_suspensions s
    WHERE s.group_id = p_group_id
      AND s.scope = 'group'
      AND s.is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.is_user_suspended_in_group(p_user_id uuid, p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_suspensions s
    WHERE s.is_active
      AND s.group_id = p_group_id
      AND (
        (s.scope = 'group')
        OR (s.scope = 'user_in_group' AND s.user_id = p_user_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_group_suspended(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_user_suspended_in_group(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_suspended(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_user_suspended_in_group(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_group_suspended(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_suspended_in_group(uuid, uuid) TO authenticated;

-- ============================================
-- 4. RLS
-- ============================================

ALTER TABLE public.moderation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_suspensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moderation_threads_select" ON public.moderation_threads;
CREATE POLICY "moderation_threads_select" ON public.moderation_threads
  FOR SELECT
  USING (
    public.is_system_admin(auth.uid())
    OR user_id = auth.uid()
    OR (
      user_id IS NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.memberships m
          WHERE m.group_id = moderation_threads.group_id AND m.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.groups g
          WHERE g.id = moderation_threads.group_id AND g.owner_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "moderation_messages_select" ON public.moderation_messages;
CREATE POLICY "moderation_messages_select" ON public.moderation_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.moderation_threads t
      WHERE t.id = moderation_messages.thread_id
        AND (
          public.is_system_admin(auth.uid())
          OR t.user_id = auth.uid()
          OR (
            t.user_id IS NULL
            AND (
              EXISTS (
                SELECT 1 FROM public.memberships m
                WHERE m.group_id = t.group_id AND m.user_id = auth.uid()
              )
              OR EXISTS (
                SELECT 1 FROM public.groups g
                WHERE g.id = t.group_id AND g.owner_id = auth.uid()
              )
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "account_suspensions_select" ON public.account_suspensions;
CREATE POLICY "account_suspensions_select" ON public.account_suspensions
  FOR SELECT
  USING (
    public.is_system_admin(auth.uid())
    OR user_id = auth.uid()
    OR (
      user_id IS NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.memberships m
          WHERE m.group_id = account_suspensions.group_id AND m.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.groups g
          WHERE g.id = account_suspensions.group_id AND g.owner_id = auth.uid()
        )
      )
    )
  );

GRANT SELECT ON public.moderation_threads TO authenticated;
GRANT SELECT ON public.moderation_messages TO authenticated;
GRANT SELECT ON public.account_suspensions TO authenticated;
GRANT ALL ON public.moderation_threads TO service_role;
GRANT ALL ON public.moderation_messages TO service_role;
GRANT ALL ON public.account_suspensions TO service_role;
