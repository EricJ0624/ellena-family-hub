-- 여행 총 예산 + 경비 유형(추가/지출)
-- Supabase SQL Editor에서 실행하세요.

-- ============================================
-- 1. travel_trips: 총 예산
-- ============================================
ALTER TABLE public.travel_trips
  ADD COLUMN IF NOT EXISTS budget NUMERIC(12,2);

COMMENT ON COLUMN public.travel_trips.budget IS '여행 총 예산 (원). 잔액 = budget + 추가합계 - 지출합계';

-- ============================================
-- 2. travel_expenses: 추가/지출 구분
-- ============================================
ALTER TABLE public.travel_expenses
  ADD COLUMN IF NOT EXISTS entry_type TEXT DEFAULT 'expense';

UPDATE public.travel_expenses SET entry_type = 'expense' WHERE entry_type IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'travel_expenses_entry_type_check'
  ) THEN
    ALTER TABLE public.travel_expenses ADD CONSTRAINT travel_expenses_entry_type_check CHECK (entry_type IN ('addition', 'expense'));
  END IF;
END $$;

COMMENT ON COLUMN public.travel_expenses.entry_type IS 'addition: 추가(입금), expense: 지출';
