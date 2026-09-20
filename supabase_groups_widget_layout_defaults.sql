-- Group-level dashboard widget layout defaults (owner restore target)
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS widget_layout_defaults jsonb;

COMMENT ON COLUMN public.groups.widget_layout_defaults IS
  'Owner-saved widget config snapshot used by restore-all defaults in group admin';
