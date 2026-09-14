-- push_tokens.app_id: 앱별 푸시 토큰 격리
ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS app_id text;

ALTER TABLE public.push_tokens
  DROP CONSTRAINT IF EXISTS push_tokens_app_id_check;

ALTER TABLE public.push_tokens
  ADD CONSTRAINT push_tokens_app_id_check
  CHECK (
    app_id IS NULL
    OR app_id = ANY (ARRAY[
      'hearth_family'::text,
      'hearth_couple'::text,
      'hearth_biker'::text,
      'hearth_camper'::text
    ])
  );

-- 동일 endpoint를 앱별로 등록 가능하도록 유니크 키 변경
ALTER TABLE public.push_tokens
  DROP CONSTRAINT IF EXISTS push_tokens_user_id_token_key;

DROP INDEX IF EXISTS push_tokens_user_id_token_key;

CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_user_id_token_app_id_key
  ON public.push_tokens (user_id, token, app_id)
  NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_app_active
  ON public.push_tokens (user_id, app_id, is_active);

COMMENT ON COLUMN public.push_tokens.app_id IS
  '토큰을 등록한 앱. NULL은 레거시(미확인) — 앱 스코프 발송에서 제외하거나 등록 시 현재 앱으로 귀속';
