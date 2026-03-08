-- auth.users FK delete_rule: travel_* 테이블 SET NULL → CASCADE
-- 계획: docs/AUTH_USERS_FK_DELETE_RULE_PLAN.md
-- 적용 시: Supabase SQL Editor 또는 `supabase db push` / MCP apply_migration

-- travel_accommodations
ALTER TABLE public.travel_accommodations DROP CONSTRAINT IF EXISTS travel_accommodations_created_by_fkey;
ALTER TABLE public.travel_accommodations ADD CONSTRAINT travel_accommodations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.travel_accommodations DROP CONSTRAINT IF EXISTS travel_accommodations_updated_by_fkey;
ALTER TABLE public.travel_accommodations ADD CONSTRAINT travel_accommodations_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.travel_accommodations DROP CONSTRAINT IF EXISTS travel_accommodations_deleted_by_fkey;
ALTER TABLE public.travel_accommodations ADD CONSTRAINT travel_accommodations_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- travel_dining
ALTER TABLE public.travel_dining DROP CONSTRAINT IF EXISTS travel_dining_created_by_fkey;
ALTER TABLE public.travel_dining ADD CONSTRAINT travel_dining_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.travel_dining DROP CONSTRAINT IF EXISTS travel_dining_updated_by_fkey;
ALTER TABLE public.travel_dining ADD CONSTRAINT travel_dining_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.travel_dining DROP CONSTRAINT IF EXISTS travel_dining_deleted_by_fkey;
ALTER TABLE public.travel_dining ADD CONSTRAINT travel_dining_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- travel_expenses
ALTER TABLE public.travel_expenses DROP CONSTRAINT IF EXISTS travel_expenses_created_by_fkey;
ALTER TABLE public.travel_expenses ADD CONSTRAINT travel_expenses_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.travel_expenses DROP CONSTRAINT IF EXISTS travel_expenses_paid_by_fkey;
ALTER TABLE public.travel_expenses ADD CONSTRAINT travel_expenses_paid_by_fkey
  FOREIGN KEY (paid_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.travel_expenses DROP CONSTRAINT IF EXISTS travel_expenses_updated_by_fkey;
ALTER TABLE public.travel_expenses ADD CONSTRAINT travel_expenses_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.travel_expenses DROP CONSTRAINT IF EXISTS travel_expenses_deleted_by_fkey;
ALTER TABLE public.travel_expenses ADD CONSTRAINT travel_expenses_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- travel_itineraries
ALTER TABLE public.travel_itineraries DROP CONSTRAINT IF EXISTS travel_itineraries_created_by_fkey;
ALTER TABLE public.travel_itineraries ADD CONSTRAINT travel_itineraries_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.travel_itineraries DROP CONSTRAINT IF EXISTS travel_itineraries_updated_by_fkey;
ALTER TABLE public.travel_itineraries ADD CONSTRAINT travel_itineraries_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.travel_itineraries DROP CONSTRAINT IF EXISTS travel_itineraries_deleted_by_fkey;
ALTER TABLE public.travel_itineraries ADD CONSTRAINT travel_itineraries_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- travel_trips (updated_by, deleted_by 만 변경; created_by 는 이미 CASCADE)
ALTER TABLE public.travel_trips DROP CONSTRAINT IF EXISTS travel_trips_updated_by_fkey;
ALTER TABLE public.travel_trips ADD CONSTRAINT travel_trips_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.travel_trips DROP CONSTRAINT IF EXISTS travel_trips_deleted_by_fkey;
ALTER TABLE public.travel_trips ADD CONSTRAINT travel_trips_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE CASCADE;
