-- Road-snapped polyline for diary/planner route maps (filled on field-track complete).
alter table public.travel_field_tracks
  add column if not exists snapped_path jsonb;

comment on column public.travel_field_tracks.snapped_path is
  'Road-snapped polyline [{lat,lng},...] from Roads Snap to Roads; filled on complete';
