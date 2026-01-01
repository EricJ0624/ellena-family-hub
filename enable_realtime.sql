-- Supabase Realtime 활성화 스크립트
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요

-- 1. Realtime publication 활성화 (필요한 경우)
-- CREATE PUBLICATION supabase_realtime FOR TABLE family_messages, family_tasks, family_events, memory_vault;

-- 2. 각 테이블에 Realtime 활성화
-- family_messages 테이블
ALTER PUBLICATION supabase_realtime ADD TABLE family_messages;

-- family_tasks 테이블
ALTER PUBLICATION supabase_realtime ADD TABLE family_tasks;

-- family_events 테이블
ALTER PUBLICATION supabase_realtime ADD TABLE family_events;

-- memory_vault 테이블
ALTER PUBLICATION supabase_realtime ADD TABLE memory_vault;

-- 확인: 현재 Realtime이 활성화된 테이블 목록
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';














