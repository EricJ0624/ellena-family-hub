-- Multi-tenant 아키텍처 마이그레이션 스크립트
-- 모든 테이블에 group_id 추가 및 RLS 정책 설정
-- Supabase SQL Editor에서 실행하세요
-- 전체 스크립트를 처음부터 끝까지 한 번에 실행하세요!

-- ============================================
-- 1. 모든 테이블에 group_id 컬럼 추가
-- ============================================

-- memory_vault 테이블 (Photos/Videos)
ALTER TABLE public.memory_vault 
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;

-- family_tasks 테이블 (Tasks)
ALTER TABLE public.family_tasks 
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;

-- family_events 테이블 (Events/Calendar)
ALTER TABLE public.family_events 
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;

-- family_messages 테이블 (Chats) - 테이블이 없을 수 있으므로 먼저 확인
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'family_messages') THEN
    ALTER TABLE public.family_messages 
      ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
  END IF;
END $$;

-- location_requests 테이블 - 그룹 내 위치 요청이므로 group_id 필요
ALTER TABLE public.location_requests 
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;

-- user_locations 테이블은 사용자별 위치이므로 group_id 없이 유지
-- 대신 위치 공유는 location_requests를 통해 group_id로 관리

-- ============================================
-- 2. group_id 컬럼을 NOT NULL로 변경 (기존 데이터 마이그레이션 후)
-- ============================================
-- 주의: 기존 데이터가 있다면 먼저 마이그레이션해야 합니다.
-- 기존 데이터가 없거나 마이그레이션이 완료되었다면 아래 주석을 해제하세요.

-- ALTER TABLE public.memory_vault ALTER COLUMN group_id SET NOT NULL;
-- ALTER TABLE public.family_tasks ALTER COLUMN group_id SET NOT NULL;
-- ALTER TABLE public.family_events ALTER COLUMN group_id SET NOT NULL;
-- ALTER TABLE public.location_requests ALTER COLUMN group_id SET NOT NULL;

-- ============================================
-- 3. group_id 인덱스 생성 (성능 향상)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_memory_vault_group_id ON public.memory_vault(group_id);
CREATE INDEX IF NOT EXISTS idx_family_tasks_group_id ON public.family_tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_family_events_group_id ON public.family_events(event_date, group_id);
CREATE INDEX IF NOT EXISTS idx_location_requests_group_id ON public.location_requests(group_id);

-- family_messages 인덱스 (테이블이 존재하는 경우)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'family_messages') THEN
    CREATE INDEX IF NOT EXISTS idx_family_messages_group_id ON public.family_messages(group_id);
  END IF;
END $$;

-- 복합 인덱스 (자주 함께 조회되는 컬럼)
CREATE INDEX IF NOT EXISTS idx_memory_vault_group_created ON public.memory_vault(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_tasks_group_created ON public.family_tasks(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_events_group_date ON public.family_events(group_id, event_date);

-- ============================================
-- 4. 기존 RLS 정책 삭제 (새로운 정책 적용 전)
-- ============================================

-- memory_vault 기존 정책 삭제
DROP POLICY IF EXISTS "사진 읽기 전체 공개" ON public.memory_vault;
DROP POLICY IF EXISTS "사진 업로드 인증 사용자" ON public.memory_vault;
DROP POLICY IF EXISTS "사진 삭제 본인 또는 관리자" ON public.memory_vault;

-- family_tasks 기존 정책 삭제
DROP POLICY IF EXISTS "할일 읽기 전체 공개" ON public.family_tasks;
DROP POLICY IF EXISTS "할일 작성 인증 사용자" ON public.family_tasks;
DROP POLICY IF EXISTS "할일 수정 관리자만" ON public.family_tasks;
DROP POLICY IF EXISTS "할일 삭제 관리자만" ON public.family_tasks;

-- family_events 기존 정책 삭제
DROP POLICY IF EXISTS "일정 읽기 전체 공개" ON public.family_events;
DROP POLICY IF EXISTS "일정 작성 인증 사용자" ON public.family_events;
DROP POLICY IF EXISTS "일정 수정 관리자만" ON public.family_events;
DROP POLICY IF EXISTS "일정 삭제 관리자만" ON public.family_events;

-- family_messages 기존 정책 삭제 (테이블이 존재하는 경우)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'family_messages') THEN
    EXECUTE 'DROP POLICY IF EXISTS "메시지 읽기 전체 공개" ON public.family_messages';
    EXECUTE 'DROP POLICY IF EXISTS "메시지 작성 인증 사용자" ON public.family_messages';
    EXECUTE 'DROP POLICY IF EXISTS "메시지 삭제 본인 또는 관리자" ON public.family_messages';
  END IF;
END $$;

-- location_requests 기존 정책 삭제
DROP POLICY IF EXISTS "위치 요청 읽기" ON public.location_requests;
DROP POLICY IF EXISTS "위치 요청 작성" ON public.location_requests;
DROP POLICY IF EXISTS "위치 요청 수정" ON public.location_requests;
DROP POLICY IF EXISTS "위치 요청 삭제" ON public.location_requests;

-- ============================================
-- 5. RLS 활성화 (이미 활성화되어 있을 수 있음)
-- ============================================

ALTER TABLE public.memory_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_requests ENABLE ROW LEVEL SECURITY;

-- family_messages RLS 활성화 (테이블이 존재하는 경우)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'family_messages') THEN
    EXECUTE 'ALTER TABLE public.family_messages ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ============================================
-- 6. Multi-tenant RLS 정책: 그룹 멤버만 접근 가능
-- ============================================

-- ============================================
-- 6.1. memory_vault (Photos/Videos) RLS 정책
-- ============================================

-- 읽기: 자신이 속한 그룹의 데이터만 조회 가능
CREATE POLICY "memory_vault 읽기 - 그룹 멤버만" ON public.memory_vault
  FOR SELECT
  USING (
    group_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.group_id = memory_vault.group_id
      AND m.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = memory_vault.group_id
      AND g.owner_id = auth.uid()
    )
  );

-- 작성: 그룹 멤버만 작성 가능 (group_id 필수)
CREATE POLICY "memory_vault 작성 - 그룹 멤버만" ON public.memory_vault
  FOR INSERT
  WITH CHECK (
    group_id IS NOT NULL AND
    (
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = memory_vault.group_id
        AND m.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = memory_vault.group_id
        AND g.owner_id = auth.uid()
      )
    ) AND
    auth.uid() = uploader_id
  );

-- 수정: 본인이 업로드한 데이터만 수정 가능 (그룹 멤버여야 함)
CREATE POLICY "memory_vault 수정 - 본인만" ON public.memory_vault
  FOR UPDATE
  USING (
    auth.uid() = uploader_id AND
    (
      group_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = memory_vault.group_id
        AND m.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = memory_vault.group_id
        AND g.owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.uid() = uploader_id AND
    (
      group_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = memory_vault.group_id
        AND m.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = memory_vault.group_id
        AND g.owner_id = auth.uid()
      )
    )
  );

-- 삭제: 본인이 업로드한 데이터 또는 그룹 ADMIN만 삭제 가능
CREATE POLICY "memory_vault 삭제 - 본인 또는 ADMIN" ON public.memory_vault
  FOR DELETE
  USING (
    auth.uid() = uploader_id OR
    (
      group_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = memory_vault.group_id
        AND m.user_id = auth.uid()
        AND m.role = 'ADMIN'
      )
    ) OR
    (
      group_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = memory_vault.group_id
        AND g.owner_id = auth.uid()
      )
    )
  );

-- ============================================
-- 6.2. family_tasks (Tasks) RLS 정책
-- ============================================

-- 읽기: 자신이 속한 그룹의 데이터만 조회 가능
CREATE POLICY "family_tasks 읽기 - 그룹 멤버만" ON public.family_tasks
  FOR SELECT
  USING (
    group_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.group_id = family_tasks.group_id
      AND m.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = family_tasks.group_id
      AND g.owner_id = auth.uid()
    )
  );

-- 작성: 그룹 멤버만 작성 가능 (group_id 필수)
CREATE POLICY "family_tasks 작성 - 그룹 멤버만" ON public.family_tasks
  FOR INSERT
  WITH CHECK (
    group_id IS NOT NULL AND
    (
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = family_tasks.group_id
        AND m.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = family_tasks.group_id
        AND g.owner_id = auth.uid()
      )
    ) AND
    auth.uid() = created_by
  );

-- 수정: 작성자 또는 그룹 ADMIN만 수정 가능
CREATE POLICY "family_tasks 수정 - 작성자 또는 ADMIN" ON public.family_tasks
  FOR UPDATE
  USING (
    (
      group_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = family_tasks.group_id
        AND m.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = family_tasks.group_id
        AND g.owner_id = auth.uid()
      )
    ) AND
    (
      auth.uid() = created_by OR
      (
        group_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM public.memberships m
          WHERE m.group_id = family_tasks.group_id
          AND m.user_id = auth.uid()
          AND m.role = 'ADMIN'
        )
      ) OR
      (
        group_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM public.groups g
          WHERE g.id = family_tasks.group_id
          AND g.owner_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    (
      group_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = family_tasks.group_id
        AND m.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = family_tasks.group_id
        AND g.owner_id = auth.uid()
      )
    ) AND
    (
      auth.uid() = created_by OR
      (
        group_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM public.memberships m
          WHERE m.group_id = family_tasks.group_id
          AND m.user_id = auth.uid()
          AND m.role = 'ADMIN'
        )
      ) OR
      (
        group_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM public.groups g
          WHERE g.id = family_tasks.group_id
          AND g.owner_id = auth.uid()
        )
      )
    )
  );

-- 삭제: 작성자 또는 그룹 ADMIN만 삭제 가능
CREATE POLICY "family_tasks 삭제 - 작성자 또는 ADMIN" ON public.family_tasks
  FOR DELETE
  USING (
    (
      group_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = family_tasks.group_id
        AND m.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = family_tasks.group_id
        AND g.owner_id = auth.uid()
      )
    ) AND
    (
      auth.uid() = created_by OR
      (
        group_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM public.memberships m
          WHERE m.group_id = family_tasks.group_id
          AND m.user_id = auth.uid()
          AND m.role = 'ADMIN'
        )
      ) OR
      (
        group_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM public.groups g
          WHERE g.id = family_tasks.group_id
          AND g.owner_id = auth.uid()
        )
      )
    )
  );

-- ============================================
-- 6.3. family_events (Events/Calendar) RLS 정책
-- ============================================

-- 읽기: 자신이 속한 그룹의 데이터만 조회 가능
CREATE POLICY "family_events 읽기 - 그룹 멤버만" ON public.family_events
  FOR SELECT
  USING (
    group_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.group_id = family_events.group_id
      AND m.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = family_events.group_id
      AND g.owner_id = auth.uid()
    )
  );

-- 작성: 그룹 멤버만 작성 가능 (group_id 필수)
CREATE POLICY "family_events 작성 - 그룹 멤버만" ON public.family_events
  FOR INSERT
  WITH CHECK (
    group_id IS NOT NULL AND
    (
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = family_events.group_id
        AND m.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = family_events.group_id
        AND g.owner_id = auth.uid()
      )
    ) AND
    auth.uid() = created_by
  );

-- 수정: 작성자 또는 그룹 ADMIN만 수정 가능
CREATE POLICY "family_events 수정 - 작성자 또는 ADMIN" ON public.family_events
  FOR UPDATE
  USING (
    (
      group_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = family_events.group_id
        AND m.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = family_events.group_id
        AND g.owner_id = auth.uid()
      )
    ) AND
    (
      auth.uid() = created_by OR
      (
        group_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM public.memberships m
          WHERE m.group_id = family_events.group_id
          AND m.user_id = auth.uid()
          AND m.role = 'ADMIN'
        )
      ) OR
      (
        group_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM public.groups g
          WHERE g.id = family_events.group_id
          AND g.owner_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    (
      group_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = family_events.group_id
        AND m.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = family_events.group_id
        AND g.owner_id = auth.uid()
      )
    ) AND
    (
      auth.uid() = created_by OR
      (
        group_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM public.memberships m
          WHERE m.group_id = family_events.group_id
          AND m.user_id = auth.uid()
          AND m.role = 'ADMIN'
        )
      ) OR
      (
        group_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM public.groups g
          WHERE g.id = family_events.group_id
          AND g.owner_id = auth.uid()
        )
      )
    )
  );

-- 삭제: 작성자 또는 그룹 ADMIN만 삭제 가능
CREATE POLICY "family_events 삭제 - 작성자 또는 ADMIN" ON public.family_events
  FOR DELETE
  USING (
    (
      group_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = family_events.group_id
        AND m.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = family_events.group_id
        AND g.owner_id = auth.uid()
      )
    ) AND
    (
      auth.uid() = created_by OR
      (
        group_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM public.memberships m
          WHERE m.group_id = family_events.group_id
          AND m.user_id = auth.uid()
          AND m.role = 'ADMIN'
        )
      ) OR
      (
        group_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM public.groups g
          WHERE g.id = family_events.group_id
          AND g.owner_id = auth.uid()
        )
      )
    )
  );

-- ============================================
-- 6.4. family_messages (Chats) RLS 정책
-- ============================================

-- family_messages 테이블이 존재하는 경우에만 정책 생성
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'family_messages') THEN
    -- 읽기: 자신이 속한 그룹의 메시지만 조회 가능
    EXECUTE '
      CREATE POLICY "family_messages 읽기 - 그룹 멤버만" ON public.family_messages
        FOR SELECT
        USING (
          group_id IS NULL OR
          EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.group_id = family_messages.group_id
            AND m.user_id = auth.uid()
          ) OR
          EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = family_messages.group_id
            AND g.owner_id = auth.uid()
          )
        )';

    -- 작성: 그룹 멤버만 작성 가능 (group_id 필수)
    EXECUTE '
      CREATE POLICY "family_messages 작성 - 그룹 멤버만" ON public.family_messages
        FOR INSERT
        WITH CHECK (
          group_id IS NOT NULL AND
          (
            EXISTS (
              SELECT 1 FROM public.memberships m
              WHERE m.group_id = family_messages.group_id
              AND m.user_id = auth.uid()
            ) OR
            EXISTS (
              SELECT 1 FROM public.groups g
              WHERE g.id = family_messages.group_id
              AND g.owner_id = auth.uid()
            )
          ) AND
          auth.uid() = sender_id
        )';

    -- 수정: 본인 메시지만 수정 가능
    EXECUTE '
      CREATE POLICY "family_messages 수정 - 본인만" ON public.family_messages
        FOR UPDATE
        USING (
          auth.uid() = sender_id AND
          (
            group_id IS NULL OR
            EXISTS (
              SELECT 1 FROM public.memberships m
              WHERE m.group_id = family_messages.group_id
              AND m.user_id = auth.uid()
            ) OR
            EXISTS (
              SELECT 1 FROM public.groups g
              WHERE g.id = family_messages.group_id
              AND g.owner_id = auth.uid()
            )
          )
        )
        WITH CHECK (
          auth.uid() = sender_id AND
          (
            group_id IS NULL OR
            EXISTS (
              SELECT 1 FROM public.memberships m
              WHERE m.group_id = family_messages.group_id
              AND m.user_id = auth.uid()
            ) OR
            EXISTS (
              SELECT 1 FROM public.groups g
              WHERE g.id = family_messages.group_id
              AND g.owner_id = auth.uid()
            )
          )
        )';

    -- 삭제: 본인 메시지 또는 그룹 ADMIN만 삭제 가능
    EXECUTE '
      CREATE POLICY "family_messages 삭제 - 본인 또는 ADMIN" ON public.family_messages
        FOR DELETE
        USING (
          auth.uid() = sender_id OR
          (
            group_id IS NOT NULL AND
            EXISTS (
              SELECT 1 FROM public.memberships m
              WHERE m.group_id = family_messages.group_id
              AND m.user_id = auth.uid()
              AND m.role = ''ADMIN''
            )
          ) OR
          (
            group_id IS NOT NULL AND
            EXISTS (
              SELECT 1 FROM public.groups g
              WHERE g.id = family_messages.group_id
              AND g.owner_id = auth.uid()
            )
          )
        )';
  END IF;
END $$;

-- ============================================
-- 6.5. location_requests RLS 정책 업데이트
-- ============================================

-- 읽기: 그룹 멤버만 그룹 내 위치 요청 조회 가능
CREATE POLICY "location_requests 읽기 - 그룹 멤버만" ON public.location_requests
  FOR SELECT
  USING (
    group_id IS NULL OR
    (
      (auth.uid() = requester_id OR auth.uid() = target_id) AND
      (
        EXISTS (
          SELECT 1 FROM public.memberships m
          WHERE m.group_id = location_requests.group_id
          AND m.user_id = auth.uid()
        ) OR
        EXISTS (
          SELECT 1 FROM public.groups g
          WHERE g.id = location_requests.group_id
          AND g.owner_id = auth.uid()
        )
      )
    )
  );

-- 작성: 그룹 멤버만 위치 요청 작성 가능 (같은 그룹 내에서만)
CREATE POLICY "location_requests 작성 - 그룹 멤버만" ON public.location_requests
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    auth.uid() = requester_id AND
    auth.uid() != target_id AND
    (
      group_id IS NULL OR
      (
        EXISTS (
          SELECT 1 FROM public.memberships m
          WHERE m.group_id = location_requests.group_id
          AND m.user_id = auth.uid()
        ) OR
        EXISTS (
          SELECT 1 FROM public.groups g
          WHERE g.id = location_requests.group_id
          AND g.owner_id = auth.uid()
        )
      ) AND
      -- 대상자도 같은 그룹에 속해 있어야 함
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = location_requests.group_id
        AND m.user_id = location_requests.target_id
        UNION
        SELECT 1 FROM public.groups g
        WHERE g.id = location_requests.group_id
        AND g.owner_id = location_requests.target_id
      )
    )
  );

-- 수정: 요청자 또는 대상자만 수정 가능 (그룹 멤버여야 함)
CREATE POLICY "location_requests 수정 - 요청자 또는 대상자" ON public.location_requests
  FOR UPDATE
  USING (
    (
      group_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = location_requests.group_id
        AND m.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = location_requests.group_id
        AND g.owner_id = auth.uid()
      )
    ) AND
    (
      (auth.uid() = target_id AND status = 'pending') OR
      (auth.uid() = requester_id AND status = 'pending')
    )
  )
  WITH CHECK (
    (
      group_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = location_requests.group_id
        AND m.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = location_requests.group_id
        AND g.owner_id = auth.uid()
      )
    ) AND
    (
      (auth.uid() = target_id AND status = 'pending') OR
      (auth.uid() = requester_id AND status = 'pending')
    )
  );

-- 삭제: 요청자 또는 대상자만 삭제 가능 (그룹 멤버여야 함)
CREATE POLICY "location_requests 삭제 - 요청자 또는 대상자" ON public.location_requests
  FOR DELETE
  USING (
    (
      group_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.group_id = location_requests.group_id
        AND m.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = location_requests.group_id
        AND g.owner_id = auth.uid()
      )
    ) AND
    (auth.uid() = requester_id OR auth.uid() = target_id)
  );

-- ============================================
-- 7. user_locations RLS 정책 업데이트 (그룹 기반 위치 공유)
-- ============================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "위치 읽기 승인된 관계" ON public.user_locations;
DROP POLICY IF EXISTS "위치 작성 본인만" ON public.user_locations;
DROP POLICY IF EXISTS "위치 수정 본인만" ON public.user_locations;
DROP POLICY IF EXISTS "위치 삭제 본인만" ON public.user_locations;

-- 읽기: 본인 위치는 항상 읽기 가능, 다른 사용자 위치는 같은 그룹 내에서 승인된 요청이 있는 경우만
CREATE POLICY "user_locations 읽기 - 본인 또는 그룹 내 승인된 관계" ON public.user_locations
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.location_requests lr
      WHERE (
        (lr.requester_id = auth.uid() AND lr.target_id = user_id) OR
        (lr.requester_id = user_id AND lr.target_id = auth.uid())
      )
      AND lr.status = 'accepted'
      AND (
        lr.group_id IS NULL OR
        EXISTS (
          SELECT 1 FROM public.memberships m
          WHERE m.group_id = lr.group_id
          AND m.user_id = auth.uid()
        ) OR
        EXISTS (
          SELECT 1 FROM public.groups g
          WHERE g.id = lr.group_id
          AND g.owner_id = auth.uid()
        )
      )
    )
  );

-- 작성/수정/삭제: 본인만 가능 (변경 없음)
CREATE POLICY "user_locations 작성 - 본인만" ON public.user_locations
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "user_locations 수정 - 본인만" ON public.user_locations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_locations 삭제 - 본인만" ON public.user_locations
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 8. 완료 메시지
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Multi-tenant 아키텍처 마이그레이션 완료!';
  RAISE NOTICE '모든 테이블에 group_id 컬럼이 추가되었습니다.';
  RAISE NOTICE 'RLS 정책이 업데이트되어 그룹 단위 데이터 격리가 적용되었습니다.';
  RAISE NOTICE '';
  RAISE NOTICE '주의사항:';
  RAISE NOTICE '1. 기존 데이터가 있다면 group_id를 설정하는 마이그레이션 스크립트를 실행해야 합니다.';
  RAISE NOTICE '2. 모든 데이터베이스 작업은 이제 group_id를 기준으로 수행되어야 합니다.';
  RAISE NOTICE '3. API 라우트와 클라이언트 코드에서 group_id 검증 로직을 추가해야 합니다.';
END $$;
