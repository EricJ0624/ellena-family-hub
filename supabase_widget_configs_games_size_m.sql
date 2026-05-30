-- Normalize games widget default size/layout to M (same as other widgets)

begin;

update public.widget_configs
set
  size = 'M',
  layout_w = 12,
  layout_h = 6,
  layout_portrait_w = 12,
  layout_portrait_h = 6,
  layout_landscape_w = 24,
  layout_landscape_h = 6
where widget_key = 'games';

commit;
