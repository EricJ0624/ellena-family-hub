-- travel_quick_record: 이전 짧은 기본 높이(4) → 5 (Neo 원형+섀도우 여유)
update public.widget_configs
set
  layout_h = 5,
  layout_portrait_h = 5,
  layout_landscape_h = 5,
  row_span = 5
where widget_key = 'travel_quick_record'
  and (
    coalesce(layout_h, 0) = 4
    or coalesce(layout_portrait_h, 0) = 4
    or coalesce(layout_landscape_h, 0) = 4
  );
