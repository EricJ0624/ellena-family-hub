-- 시스템 관리자 위젯 활동량 집계
-- 가족 콘텐츠(채팅/일정 등)는 삭제하지 않음.
-- 스냅샷 = 기간별 저장, resets = 집계 기준점 초기화.

-- ============================================
-- 1. 집계 기준점 (초기화)
-- ============================================

CREATE TABLE IF NOT EXISTS public.feature_usage_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reset_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.feature_usage_resets IS '시스템 관리자 위젯 활동량 집계 기준점. 가족 데이터는 삭제하지 않음.';

CREATE INDEX IF NOT EXISTS idx_feature_usage_resets_reset_at
  ON public.feature_usage_resets(reset_at DESC);

-- ============================================
-- 2. 기간별 저장 스냅샷
-- ============================================

CREATE TABLE IF NOT EXISTS public.feature_usage_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_label TEXT NOT NULL DEFAULT 'custom',
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  per_group JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_reset_at TIMESTAMPTZ,
  saved_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

COMMENT ON TABLE public.feature_usage_snapshots IS '시스템 관리자가 저장한 기간별 위젯 활동량 스냅샷';

CREATE INDEX IF NOT EXISTS idx_feature_usage_snapshots_saved_at
  ON public.feature_usage_snapshots(saved_at DESC);

-- ============================================
-- 3. RLS — 시스템 관리자 SELECT만, 쓰기는 서비스 롤(API)
-- ============================================

ALTER TABLE public.feature_usage_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_usage_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_usage_resets_select_system_admin" ON public.feature_usage_resets;
CREATE POLICY "feature_usage_resets_select_system_admin" ON public.feature_usage_resets
  FOR SELECT
  USING (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "feature_usage_snapshots_select_system_admin" ON public.feature_usage_snapshots;
CREATE POLICY "feature_usage_snapshots_select_system_admin" ON public.feature_usage_snapshots
  FOR SELECT
  USING (public.is_system_admin(auth.uid()));

GRANT SELECT ON public.feature_usage_resets TO authenticated;
GRANT SELECT ON public.feature_usage_snapshots TO authenticated;
GRANT ALL ON public.feature_usage_resets TO service_role;
GRANT ALL ON public.feature_usage_snapshots TO service_role;

-- ============================================
-- 4. 위젯별 활동량 RPC (서비스 롤 전용)
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_feature_usage_counts(
  p_from timestamptz,
  p_to timestamptz,
  p_group_id uuid DEFAULT NULL
)
RETURNS TABLE(widget_key text, group_id uuid, activity_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'chat'::text, m.group_id, count(*)::bigint
  FROM public.family_chat_messages m
  WHERE m.created_at >= p_from AND m.created_at < p_to
    AND (p_group_id IS NULL OR m.group_id = p_group_id)
  GROUP BY m.group_id

  UNION ALL
  SELECT 'calendar'::text, e.group_id, count(*)::bigint
  FROM public.family_events e
  WHERE e.created_at >= p_from AND e.created_at < p_to
    AND (p_group_id IS NULL OR e.group_id = p_group_id)
  GROUP BY e.group_id

  UNION ALL
  SELECT 'tasks'::text, t.group_id, count(*)::bigint
  FROM public.family_tasks t
  WHERE t.created_at >= p_from AND t.created_at < p_to
    AND (p_group_id IS NULL OR t.group_id = p_group_id)
  GROUP BY t.group_id

  UNION ALL
  SELECT 'album'::text, a.group_id, count(*)::bigint
  FROM public.family_album_items a
  WHERE a.created_at >= p_from AND a.created_at < p_to
    AND (p_group_id IS NULL OR a.group_id = p_group_id)
  GROUP BY a.group_id

  UNION ALL
  SELECT 'location'::text, l.group_id, count(*)::bigint
  FROM public.location_requests l
  WHERE l.created_at >= p_from AND l.created_at < p_to
    AND (p_group_id IS NULL OR l.group_id = p_group_id)
  GROUP BY l.group_id

  UNION ALL
  SELECT 'travel'::text, tr.group_id, count(*)::bigint
  FROM public.travel_trips tr
  WHERE tr.deleted_at IS NULL
    AND tr.created_at >= p_from AND tr.created_at < p_to
    AND (p_group_id IS NULL OR tr.group_id = p_group_id)
  GROUP BY tr.group_id

  UNION ALL
  SELECT 'travel_diary'::text, d.group_id, count(*)::bigint
  FROM public.travel_diary_entries d
  WHERE d.deleted_at IS NULL
    AND d.created_at >= p_from AND d.created_at < p_to
    AND (p_group_id IS NULL OR d.group_id = p_group_id)
  GROUP BY d.group_id

  UNION ALL
  SELECT 'piggy'::text, p.group_id, count(*)::bigint
  FROM public.piggy_bank_transactions p
  WHERE p.created_at >= p_from AND p.created_at < p_to
    AND (p_group_id IS NULL OR p.group_id = p_group_id)
  GROUP BY p.group_id

  UNION ALL
  SELECT 'games'::text, g.group_id, count(*)::bigint
  FROM (
    SELECT gs.group_id
    FROM public.family_game_sessions gs
    WHERE gs.created_at >= p_from AND gs.created_at < p_to
      AND (p_group_id IS NULL OR gs.group_id = p_group_id)
    UNION ALL
    SELECT pf.group_id
    FROM public.picture_find_attempts pf
    WHERE pf.created_at >= p_from AND pf.created_at < p_to
      AND (p_group_id IS NULL OR pf.group_id = p_group_id)
  ) g
  GROUP BY g.group_id
$$;

REVOKE ALL ON FUNCTION public.admin_feature_usage_counts(timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_feature_usage_counts(timestamptz, timestamptz, uuid) TO service_role;
