-- profiles 테이블에 nickname 컬럼 추가 및 관련 기능 설정

-- 1. profiles 테이블에 nickname 컬럼 추가 (없는 경우에만)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'nickname'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN nickname VARCHAR(50);
    
    COMMENT ON COLUMN profiles.nickname IS '사용자 닉네임 (2-20자 권장)';
  END IF;
END $$;

-- 2. 기존 사용자의 nickname을 user_metadata에서 가져와서 업데이트 (한 번만 실행)
UPDATE profiles p
SET nickname = (
  SELECT raw_user_meta_data->>'nickname'
  FROM auth.users u
  WHERE u.id = p.id
  AND raw_user_meta_data->>'nickname' IS NOT NULL
  AND raw_user_meta_data->>'nickname' != ''
)
WHERE nickname IS NULL
AND EXISTS (
  SELECT 1 FROM auth.users u
  WHERE u.id = p.id
  AND raw_user_meta_data->>'nickname' IS NOT NULL
  AND raw_user_meta_data->>'nickname' != ''
);

-- 3. nickname에 대한 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON profiles(nickname) WHERE nickname IS NOT NULL;

-- 4. nickname 업데이트를 위한 함수 (트리거에서 사용)
CREATE OR REPLACE FUNCTION update_user_nickname()
RETURNS TRIGGER AS $$
BEGIN
  -- profiles 테이블의 nickname이 업데이트되면 auth.users의 user_metadata도 동기화
  IF NEW.nickname IS DISTINCT FROM OLD.nickname THEN
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('nickname', NEW.nickname)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 트리거 생성 (profiles.nickname 업데이트 시 auth.users 동기화)
DROP TRIGGER IF EXISTS sync_nickname_to_auth_users ON profiles;
CREATE TRIGGER sync_nickname_to_auth_users
  AFTER UPDATE OF nickname ON profiles
  FOR EACH ROW
  WHEN (NEW.nickname IS DISTINCT FROM OLD.nickname)
  EXECUTE FUNCTION update_user_nickname();

-- 6. RLS 정책 확인 (nickname은 본인만 수정 가능)
-- profiles 테이블의 RLS가 이미 설정되어 있다면 자동으로 적용됨

-- 7. 확인 쿼리
SELECT 
  id, 
  email, 
  nickname,
  created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 10;

