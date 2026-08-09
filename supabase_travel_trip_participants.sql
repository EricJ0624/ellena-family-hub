-- 여행별 참가자 (일정표 TRAVELERS)
-- 그룹 멤버 중 해당 여행에 참여하는 user_id만 저장

CREATE TABLE IF NOT EXISTS public.travel_trip_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.travel_trips(id) ON DELETE CASCADE,
  group_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_travel_trip_participants_trip_id
  ON public.travel_trip_participants (trip_id);
CREATE INDEX IF NOT EXISTS idx_travel_trip_participants_group_id
  ON public.travel_trip_participants (group_id);
CREATE INDEX IF NOT EXISTS idx_travel_trip_participants_user_id
  ON public.travel_trip_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_travel_trip_participants_deleted_at
  ON public.travel_trip_participants (deleted_at) WHERE deleted_at IS NULL;

ALTER TABLE public.travel_trip_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS travel_trip_participants_select ON public.travel_trip_participants;
DROP POLICY IF EXISTS travel_trip_participants_insert ON public.travel_trip_participants;
DROP POLICY IF EXISTS travel_trip_participants_update ON public.travel_trip_participants;
DROP POLICY IF EXISTS travel_trip_participants_delete ON public.travel_trip_participants;

CREATE POLICY travel_trip_participants_select ON public.travel_trip_participants
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY travel_trip_participants_insert ON public.travel_trip_participants
  FOR INSERT WITH CHECK (public.is_group_member(group_id, auth.uid()));
CREATE POLICY travel_trip_participants_update ON public.travel_trip_participants
  FOR UPDATE USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY travel_trip_participants_delete ON public.travel_trip_participants
  FOR DELETE USING (public.is_group_member(group_id, auth.uid()));

COMMENT ON TABLE public.travel_trip_participants IS '여행별 참가자 (그룹 멤버 중 이 여행에 참여하는 사용자)';
