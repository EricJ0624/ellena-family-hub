-- Planner-only hide: keep trip row for diary when diary_enabled.
-- Applied via Supabase migration travel_trips_planner_hidden.

ALTER TABLE public.travel_trips
  ADD COLUMN IF NOT EXISTS planner_hidden_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS planner_hidden_by uuid NULL;

COMMENT ON COLUMN public.travel_trips.planner_hidden_at IS
  'Set when removed from travel planner UI; trip stays for diary if not deleted_at.';
COMMENT ON COLUMN public.travel_trips.planner_hidden_by IS
  'User who hid the trip from planner.';

CREATE INDEX IF NOT EXISTS travel_trips_group_planner_hidden_idx
  ON public.travel_trips (group_id)
  WHERE deleted_at IS NULL AND planner_hidden_at IS NULL;
