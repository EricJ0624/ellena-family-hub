-- 멤버 역할 변경 함수 추가
-- Supabase SQL Editor에서 실행하세요

-- ============================================
-- 멤버 역할 변경 함수 (SECURITY DEFINER)
-- ============================================

CREATE OR REPLACE FUNCTION public.update_member_role(
  target_user_id UUID,
  target_group_id UUID,
  new_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  group_owner_id UUID;
  is_current_user_admin BOOLEAN;
  is_target_user_owner BOOLEAN;
BEGIN
  -- 현재 인증된 사용자 ID 가져오기
  current_user_id := auth.uid();
  
  -- 인증 확인
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION '인증이 필요합니다.';
  END IF;

  -- 역할 검증
  IF new_role NOT IN ('ADMIN', 'MEMBER') THEN
    RAISE EXCEPTION '유효하지 않은 역할입니다. (ADMIN, MEMBER만 가능)';
  END IF;

  -- 그룹 존재 확인 및 소유자 확인
  SELECT owner_id INTO group_owner_id
  FROM public.groups
  WHERE id = target_group_id;

  IF group_owner_id IS NULL THEN
    RAISE EXCEPTION '그룹을 찾을 수 없습니다.';
  END IF;

  -- 대상 사용자가 그룹 소유자인지 확인
  is_target_user_owner := (group_owner_id = target_user_id);

  -- 소유자의 역할은 변경 불가
  IF is_target_user_owner THEN
    RAISE EXCEPTION '그룹 소유자의 역할은 변경할 수 없습니다.';
  END IF;

  -- 자기 자신의 역할은 변경 불가
  IF current_user_id = target_user_id THEN
    RAISE EXCEPTION '자기 자신의 역할은 변경할 수 없습니다.';
  END IF;

  -- 현재 사용자가 그룹 관리자(소유자 또는 ADMIN)인지 확인
  -- 소유자인지 확인
  IF group_owner_id = current_user_id THEN
    is_current_user_admin := TRUE;
  ELSE
    -- ADMIN 권한 확인
    SELECT EXISTS(
      SELECT 1 FROM public.memberships
      WHERE user_id = current_user_id
      AND group_id = target_group_id
      AND role = 'ADMIN'
    ) INTO is_current_user_admin;
  END IF;

  -- 관리자 권한이 없으면 예외 발생
  IF NOT is_current_user_admin THEN
    RAISE EXCEPTION '멤버 역할을 변경할 권한이 없습니다. (관리자만 가능)';
  END IF;

  -- 대상 사용자가 그룹 멤버인지 확인
  IF NOT EXISTS(
    SELECT 1 FROM public.memberships
    WHERE user_id = target_user_id
    AND group_id = target_group_id
  ) THEN
    RAISE EXCEPTION '해당 사용자는 그룹 멤버가 아닙니다.';
  END IF;

  -- 역할 업데이트
  UPDATE public.memberships
  SET role = new_role
  WHERE user_id = target_user_id
  AND group_id = target_group_id;

  -- 업데이트 성공 확인
  IF FOUND THEN
    RETURN TRUE;
  ELSE
    RAISE EXCEPTION '역할 업데이트에 실패했습니다.';
  END IF;
END;
$$;

-- 함수 설명 추가
COMMENT ON FUNCTION public.update_member_role IS 
'그룹 관리자(소유자 또는 ADMIN)가 다른 멤버의 역할을 변경할 수 있습니다. 
- 자기 자신의 역할은 변경 불가
- 그룹 소유자의 역할은 변경 불가
- 대상 사용자는 그룹 멤버여야 함';

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '멤버 역할 변경 함수가 생성되었습니다.';
  RAISE NOTICE '함수명: update_member_role(target_user_id, target_group_id, new_role)';
END $$;

