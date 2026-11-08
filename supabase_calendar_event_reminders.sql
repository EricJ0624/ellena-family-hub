-- Calendar event multi-offset reminders (day/week/month only)

ALTER TABLE public.family_events
  ADD COLUMN IF NOT EXISTS remind_offsets smallint[] NOT NULL DEFAULT '{}'::smallint[];

COMMENT ON COLUMN public.family_events.remind_offsets IS
  'Reminder offsets in days before event_date. Allowed: 1,3,7,14,30. Empty = no reminders.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'family_events_remind_offsets_allowed'
  ) THEN
    ALTER TABLE public.family_events
      ADD CONSTRAINT family_events_remind_offsets_allowed
      CHECK (
        remind_offsets <@ ARRAY[1, 3, 7, 14, 30]::smallint[]
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.calendar_reminder_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.family_events(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  offset_days smallint NOT NULL,
  fire_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_reminder_dispatches_offset_allowed
    CHECK (offset_days = ANY (ARRAY[1, 3, 7, 14, 30]::smallint[])),
  CONSTRAINT calendar_reminder_dispatches_unique
    UNIQUE (event_id, offset_days, fire_date)
);

CREATE INDEX IF NOT EXISTS idx_calendar_reminder_dispatches_group_fire
  ON public.calendar_reminder_dispatches (group_id, fire_date DESC);

CREATE INDEX IF NOT EXISTS idx_family_events_remind_offsets
  ON public.family_events
  USING gin (remind_offsets)
  WHERE cardinality(remind_offsets) > 0;

-- GRANT (required for new tables since 2024-10-30)
grant select
  on public.calendar_reminder_dispatches
  to anon;

grant select, insert, update, delete
  on public.calendar_reminder_dispatches
  to authenticated;

grant select, insert, update, delete
  on public.calendar_reminder_dispatches
  to service_role;

alter table public.calendar_reminder_dispatches enable row level security;

drop policy if exists calendar_reminder_dispatches_select_member on public.calendar_reminder_dispatches;
create policy calendar_reminder_dispatches_select_member
  on public.calendar_reminder_dispatches
  for select
  using (
    exists (
      select 1 from public.memberships m
      where m.group_id = calendar_reminder_dispatches.group_id
        and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.groups g
      where g.id = calendar_reminder_dispatches.group_id
        and g.owner_id = auth.uid()
    )
  );

-- Writes are service_role only (cron). No insert/update/delete policies for authenticated.
