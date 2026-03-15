-- Fix: user_locations RLS 정책 수정
-- 문제: status = 'approved'로 되어있었지만, 실제 데이터는 'accepted'
-- 날짜: 2026-03-15

DROP POLICY IF EXISTS user_locations_select_by_group ON user_locations;

CREATE POLICY user_locations_select_by_group ON user_locations
FOR SELECT
USING (
  group_id IN (
    SELECT group_id FROM memberships WHERE user_id = auth.uid()
  )
  AND (
    user_id = auth.uid()  -- 본인 위치는 항상 볼 수 있음
    OR EXISTS (
      SELECT 1 FROM location_requests lr
      WHERE lr.group_id = user_locations.group_id
        AND lr.status = 'accepted'  -- ✅ approved → accepted 수정
        AND (
          (lr.requester_id = auth.uid() AND lr.target_id = user_locations.user_id)
          OR (lr.target_id = auth.uid() AND lr.requester_id = user_locations.user_id)
        )
    )
  )
);

COMMENT ON POLICY user_locations_select_by_group ON user_locations IS 
'Allow users to view their own location and locations of users with accepted location requests in the same group';
