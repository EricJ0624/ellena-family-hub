-- Place feedback + travel_expenses linkage for travel diary
-- Run after supabase_travel_trip_status_and_diary.sql

begin;

-- Extend travel_expenses
alter table public.travel_expenses
  add column if not exists source_kind text;

alter table public.travel_expenses
  add column if not exists source_id uuid;

alter table public.travel_expenses
  add column if not exists diary_origin boolean not null default false;

alter table public.travel_expenses
  drop constraint if exists travel_expenses_source_kind_check;

alter table public.travel_expenses
  add constraint travel_expenses_source_kind_check
  check (
    source_kind is null
    or source_kind in ('attraction', 'dining', 'accommodation', 'transport', 'itinerary')
  );

create index if not exists idx_travel_expenses_trip_source
  on public.travel_expenses (trip_id, source_kind, source_id)
  where deleted_at is null and source_kind is not null and source_id is not null;

comment on column public.travel_expenses.source_kind is 'Linked planner place kind (diary sync)';
comment on column public.travel_expenses.source_id is 'Linked planner entity id';
comment on column public.travel_expenses.diary_origin is 'Created/updated from diary place expense sync';

-- Place feedback table
create table if not exists public.travel_place_feedback (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  trip_id uuid not null references public.travel_trips(id) on delete cascade,
  source_kind text not null check (
    source_kind in ('attraction', 'dining', 'accommodation', 'transport', 'itinerary')
  ),
  source_id uuid not null,
  rating smallint check (rating is null or (rating >= 1 and rating <= 5)),
  is_revisit boolean,
  feedback_note text,
  travel_expense_id uuid references public.travel_expenses(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create unique index if not exists uq_travel_place_feedback_source
  on public.travel_place_feedback (group_id, source_kind, source_id)
  where deleted_at is null;

create index if not exists idx_travel_place_feedback_trip
  on public.travel_place_feedback (trip_id)
  where deleted_at is null;

create index if not exists idx_travel_place_feedback_group
  on public.travel_place_feedback (group_id)
  where deleted_at is null;

alter table public.travel_place_feedback enable row level security;

drop policy if exists "travel_place_feedback_select" on public.travel_place_feedback;
create policy "travel_place_feedback_select" on public.travel_place_feedback
  for select using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "travel_place_feedback_insert" on public.travel_place_feedback;
create policy "travel_place_feedback_insert" on public.travel_place_feedback
  for insert with check (public.is_group_member(group_id, auth.uid()));

drop policy if exists "travel_place_feedback_update" on public.travel_place_feedback;
create policy "travel_place_feedback_update" on public.travel_place_feedback
  for update using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "travel_place_feedback_delete" on public.travel_place_feedback;
create policy "travel_place_feedback_delete" on public.travel_place_feedback
  for delete using (public.is_group_member(group_id, auth.uid()));

comment on table public.travel_place_feedback is 'Per-place ratings/notes/expense link for travel diary';

commit;
