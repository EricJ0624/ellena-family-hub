-- 관리자 쇼룸 미리보기 영상. 대시보드 입장 권한과 무관.
-- 클라이언트 역할에는 권한을 주지 않는다. 서버 service role API만 읽고 쓴다.

create table if not exists public.showroom_preview_videos (
  id uuid primary key default gen_random_uuid(),
  widget_key text not null,
  lang text not null,
  storage_path text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint showroom_preview_videos_widget_lang_key unique (widget_key, lang)
);

alter table public.showroom_preview_videos enable row level security;

revoke all on table public.showroom_preview_videos from anon, authenticated;

comment on table public.showroom_preview_videos is
  'Admin-only showroom preview videos. Not a dashboard access grant.';
