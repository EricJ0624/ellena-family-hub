-- 관리자만 수정 가능하도록 RLS 정책 변경
-- Supabase SQL Editor에서 실행하세요

-- ============================================
-- 기존 정책 삭제
-- ============================================

DROP POLICY IF EXISTS "가족 데이터 전체 공개" ON public.profiles;
DROP POLICY IF EXISTS "할일 전체 공개" ON public.family_tasks;
DROP POLICY IF EXISTS "일정 전체 공개" ON public.family_events;
DROP POLICY IF EXISTS "채팅 전체 공개" ON public.family_messages;
DROP POLICY IF EXISTS "사진 전체 공개" ON public.memory_vault;
DROP POLICY IF EXISTS "위치 전체 공개" ON public.user_locations;

-- ============================================
-- 새로운 정책: 관리자만 수정 가능
-- ============================================

-- profiles: 모든 사용자 읽기, 본인만 수정
CREATE POLICY "프로필 읽기 전체 공개" ON public.profiles 
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "프로필 수정 본인만" ON public.profiles 
  FOR UPDATE USING (auth.uid() = id);

-- family_tasks: 모든 사용자 읽기, 관리자만 수정/삭제, 모든 사용자 작성 가능
CREATE POLICY "할일 읽기 전체 공개" ON public.family_tasks 
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "할일 작성 인증 사용자" ON public.family_tasks 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "할일 수정 관리자만" ON public.family_tasks 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
CREATE POLICY "할일 삭제 관리자만" ON public.family_tasks 
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- family_events: 모든 사용자 읽기, 관리자만 수정/삭제, 모든 사용자 작성 가능
CREATE POLICY "일정 읽기 전체 공개" ON public.family_events 
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "일정 작성 인증 사용자" ON public.family_events 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "일정 수정 관리자만" ON public.family_events 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
CREATE POLICY "일정 삭제 관리자만" ON public.family_events 
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- family_messages: 모든 사용자 읽기/작성, 본인 메시지만 삭제 가능
CREATE POLICY "메시지 읽기 전체 공개" ON public.family_messages 
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "메시지 작성 인증 사용자" ON public.family_messages 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "메시지 삭제 본인 또는 관리자" ON public.family_messages 
  FOR DELETE USING (
    sender_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- memory_vault: 모든 사용자 읽기/업로드, 본인 사진만 삭제 가능
CREATE POLICY "사진 읽기 전체 공개" ON public.memory_vault 
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "사진 업로드 인증 사용자" ON public.memory_vault 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "사진 삭제 본인 또는 관리자" ON public.memory_vault 
  FOR DELETE USING (
    uploader_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- user_locations: 모든 사용자 읽기, 본인 위치만 수정
CREATE POLICY "위치 읽기 전체 공개" ON public.user_locations 
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "위치 수정 본인만" ON public.user_locations 
  FOR ALL USING (id = auth.uid());



















































