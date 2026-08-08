-- Games widget: match M preset height (12×8) so lobby + picture-find fit without inner scroll
begin;

update public.widget_configs
set
  size = 'M',
  layout_w = 12,
  layout_h = 8,
  layout_portrait_w = 12,
  layout_portrait_h = 8,
  layout_landscape_w = 24,
  layout_landscape_h = 8
where widget_key = 'games';

commit;
