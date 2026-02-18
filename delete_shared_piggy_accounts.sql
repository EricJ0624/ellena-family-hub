-- 공용 저금통 (user_id가 NULL인 piggy_bank_accounts) 삭제
-- 아이별 저금통으로 완전히 전환되었으므로 공용 저금통은 더 이상 필요하지 않음

DELETE FROM piggy_bank_accounts
WHERE user_id IS NULL;

-- 삭제된 레코드 수 확인 (선택사항)
-- SELECT COUNT(*) FROM piggy_bank_accounts WHERE user_id IS NULL;
