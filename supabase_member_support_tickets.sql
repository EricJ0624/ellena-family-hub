-- 일반 멤버 <-> 그룹 관리자 문의 시스템
-- Supabase SQL Editor에서 실행하세요.

-- ============================================
-- 1. 멤버 문의 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS public.member_support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- 일반 멤버(또는 그룹 내 사용자)
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'closed')),
  answer TEXT,
  answered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- 그룹 관리자
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- 2. 인덱스
-- ============================================

CREATE INDEX IF NOT EXISTS idx_member_support_tickets_group_id ON public.member_support_tickets(group_id);
CREATE INDEX IF NOT EXISTS idx_member_support_tickets_created_by ON public.member_support_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_member_support_tickets_status ON public.member_support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_member_support_tickets_created_at ON public.member_support_tickets(created_at DESC);

-- ============================================
-- 3. updated_at 트리거
-- ============================================

CREATE OR REPLACE FUNCTION public.update_member_support_tickets_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_member_support_tickets_updated_at ON public.member_support_tickets;
CREATE TRIGGER update_member_support_tickets_updated_at
  BEFORE UPDATE ON public.member_support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_member_support_tickets_updated_at_column();

-- ============================================
-- 4. RLS + 정책
-- ============================================

ALTER TABLE public.member_support_tickets ENABLE ROW LEVEL SECURITY;

-- 읽기: 본인이 작성한 문의, 또는 해당 그룹의 ADMIN/소유자
DROP POLICY IF EXISTS "멤버 문의 읽기" ON public.member_support_tickets;
CREATE POLICY "멤버 문의 읽기" ON public.member_support_tickets
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.memberships
      WHERE group_id = member_support_tickets.group_id
        AND user_id = auth.uid()
        AND role = 'ADMIN'
    )
    OR EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = member_support_tickets.group_id
        AND owner_id = auth.uid()
    )
  );

-- 작성: 해당 그룹 멤버(ADMIN/MEMBER) 또는 소유자
DROP POLICY IF EXISTS "멤버 문의 작성" ON public.member_support_tickets;
CREATE POLICY "멤버 문의 작성" ON public.member_support_tickets
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.memberships
        WHERE group_id = member_support_tickets.group_id
          AND user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.groups
        WHERE id = member_support_tickets.group_id
          AND owner_id = auth.uid()
      )
    )
  );

-- 수정: 작성자(상태 close 등) 또는 그룹 ADMIN/소유자(답변/상태 변경)
DROP POLICY IF EXISTS "멤버 문의 수정" ON public.member_support_tickets;
CREATE POLICY "멤버 문의 수정" ON public.member_support_tickets
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.memberships
      WHERE group_id = member_support_tickets.group_id
        AND user_id = auth.uid()
        AND role = 'ADMIN'
    )
    OR EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = member_support_tickets.group_id
        AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.memberships
      WHERE group_id = member_support_tickets.group_id
        AND user_id = auth.uid()
        AND role = 'ADMIN'
    )
    OR EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = member_support_tickets.group_id
        AND owner_id = auth.uid()
    )
  );

-- 삭제: 작성자 또는 그룹 ADMIN/소유자
DROP POLICY IF EXISTS "멤버 문의 삭제" ON public.member_support_tickets;
CREATE POLICY "멤버 문의 삭제" ON public.member_support_tickets
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.memberships
      WHERE group_id = member_support_tickets.group_id
        AND user_id = auth.uid()
        AND role = 'ADMIN'
    )
    OR EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = member_support_tickets.group_id
        AND owner_id = auth.uid()
    )
  );

