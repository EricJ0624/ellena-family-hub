-- announcements 테이블에 target 컬럼 추가
-- target: 공지사항 대상 (ADMIN_ONLY: 관리자만, ALL_MEMBERS: 모든 멤버)

-- 1. target 컬럼 추가 (기본값: ADMIN_ONLY)
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS target TEXT NOT NULL DEFAULT 'ADMIN_ONLY' 
CHECK (target IN ('ADMIN_ONLY', 'ALL_MEMBERS'));

-- 2. 기존 데이터는 모두 ADMIN_ONLY로 설정 (이미 기본값으로 설정됨)
UPDATE announcements 
SET target = 'ADMIN_ONLY' 
WHERE target IS NULL;

-- 3. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_announcements_target ON announcements(target);
CREATE INDEX IF NOT EXISTS idx_announcements_active_target ON announcements(is_active, target);

-- 완료 메시지
SELECT 'announcements 테이블에 target 컬럼이 추가되었습니다.' AS message;
