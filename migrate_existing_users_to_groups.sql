-- ============================================
-- 기존 사용자 그룹 시스템 마이그레이션 스크립트
-- soungtak@gmail.com을 관리자로, 나머지를 가족 멤버로 설정
-- ============================================
-- 
-- 사용 방법:
-- 1. Supabase SQL Editor에서 실행
-- 2. 실행 후 결과 확인 쿼리 실행
-- ============================================

DO $$
DECLARE
  admin_user_id UUID;
  default_group_id UUID;
  default_invite_code TEXT;
  member_count INTEGER;
BEGIN
  -- 1. 관리자 사용자 찾기
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'soungtak@gmail.com';
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION '관리자 사용자(soungtak@gmail.com)를 찾을 수 없습니다.';
  END IF;
  
  RAISE NOTICE '관리자 사용자 확인: %', admin_user_id;
  
  -- 2. 기본 그룹 생성 (관리자를 소유자로)
  default_invite_code := public.generate_secure_invite_code();
  
  INSERT INTO public.groups (name, invite_code, owner_id)
  VALUES ('우리 가족', default_invite_code, admin_user_id)
  RETURNING id INTO default_group_id;
  
  RAISE NOTICE '기본 그룹 생성 완료: % (소유자: %)', default_group_id, admin_user_id;
  RAISE NOTICE '초대 코드: %', default_invite_code;
  
  -- 3. 관리자를 ADMIN으로 추가 (트리거로 자동 추가되지만 명시적으로 추가)
  INSERT INTO public.memberships (user_id, group_id, role)
  VALUES (admin_user_id, default_group_id, 'ADMIN')
  ON CONFLICT (user_id, group_id) 
  DO UPDATE SET role = 'ADMIN';
  
  RAISE NOTICE '관리자 ADMIN 권한 설정 완료';
  
  -- 4. 나머지 모든 사용자를 MEMBER로 추가
  INSERT INTO public.memberships (user_id, group_id, role)
  SELECT 
    u.id,
    default_group_id,
    'MEMBER'
  FROM auth.users u
  WHERE u.id != admin_user_id  -- 관리자 제외
    AND NOT EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = u.id AND m.group_id = default_group_id
    )
  ON CONFLICT (user_id, group_id) DO NOTHING;
  
  GET DIAGNOSTICS member_count = ROW_COUNT;
  
  RAISE NOTICE '가족 멤버 추가 완료: %명', member_count;
  
  -- 5. 결과 요약
  RAISE NOTICE '========================================';
  RAISE NOTICE '마이그레이션 완료!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '그룹 ID: %', default_group_id;
  RAISE NOTICE '그룹 이름: 우리 가족';
  RAISE NOTICE '초대 코드: %', default_invite_code;
  RAISE NOTICE '관리자: soungtak@gmail.com (ADMIN)';
  RAISE NOTICE '가족 멤버: %명 (MEMBER)', member_count;
  RAISE NOTICE '========================================';
  
END $$;

-- ============================================
-- 마이그레이션 결과 확인 쿼리
-- ============================================

-- 그룹 및 멤버 통계
SELECT 
  g.id AS group_id,
  g.name AS group_name,
  g.invite_code,
  u.email AS owner_email,
  COUNT(m.user_id) AS total_members,
  COUNT(CASE WHEN m.role = 'ADMIN' THEN 1 END) AS admin_count,
  COUNT(CASE WHEN m.role = 'MEMBER' THEN 1 END) AS member_count
FROM public.groups g
LEFT JOIN auth.users u ON g.owner_id = u.id
LEFT JOIN public.memberships m ON g.id = m.group_id
WHERE g.name = '우리 가족'
GROUP BY g.id, g.name, g.invite_code, u.email;

-- 멤버 상세 정보
SELECT 
  u.email,
  u.id AS user_id,
  m.role,
  CASE 
    WHEN g.owner_id = u.id THEN '소유자'
    ELSE '멤버'
  END AS status
FROM public.memberships m
JOIN auth.users u ON m.user_id = u.id
JOIN public.groups g ON m.group_id = g.id
WHERE g.name = '우리 가족'
ORDER BY 
  CASE WHEN m.role = 'ADMIN' THEN 1 ELSE 2 END,
  u.email;

-- 그룹에 속하지 않은 사용자 확인 (있으면 문제)
SELECT 
  u.email,
  u.id,
  COUNT(m.group_id) AS group_count
FROM auth.users u
LEFT JOIN public.memberships m ON u.id = m.user_id
GROUP BY u.id, u.email
HAVING COUNT(m.group_id) = 0;

