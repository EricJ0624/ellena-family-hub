-- Multi bank accounts per child (max 3). Full account number display in app.
-- Keeps existing rows; drops one-account unique(group_id, user_id).

alter table public.piggy_savings_accounts
  drop constraint if exists piggy_savings_accounts_group_id_user_id_key;

alter table public.piggy_savings_accounts
  add column if not exists bank_name text not null default '',
  add column if not exists account_number text not null default '',
  add column if not exists account_label text not null default 'Saving';

alter table public.piggy_savings_transactions
  add column if not exists savings_account_id uuid null
    references public.piggy_savings_accounts(id) on delete set null;

update public.piggy_savings_transactions t
set savings_account_id = a.id
from public.piggy_savings_accounts a
where t.savings_account_id is null
  and t.group_id = a.group_id
  and t.user_id = a.user_id;

alter table public.piggy_savings_withdraw_requests
  add column if not exists savings_account_id uuid null
    references public.piggy_savings_accounts(id) on delete set null;

update public.piggy_savings_withdraw_requests r
set savings_account_id = a.id
from public.piggy_savings_accounts a
where r.savings_account_id is null
  and r.group_id = a.group_id
  and r.child_id = a.user_id;

create or replace function public.piggy_savings_accounts_enforce_max_3()
returns trigger
language plpgsql
as $$
declare
  cnt integer;
begin
  select count(*) into cnt
  from public.piggy_savings_accounts
  where group_id = new.group_id
    and user_id = new.user_id;
  if tg_op = 'INSERT' and cnt >= 3 then
    raise exception 'MAX_SAVINGS_ACCOUNTS' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and (old.group_id is distinct from new.group_id or old.user_id is distinct from new.user_id) then
    select count(*) into cnt
    from public.piggy_savings_accounts
    where group_id = new.group_id
      and user_id = new.user_id
      and id is distinct from new.id;
    if cnt >= 3 then
      raise exception 'MAX_SAVINGS_ACCOUNTS' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_piggy_savings_accounts_max_3 on public.piggy_savings_accounts;
create trigger trg_piggy_savings_accounts_max_3
  before insert or update of group_id, user_id
  on public.piggy_savings_accounts
  for each row
  execute function public.piggy_savings_accounts_enforce_max_3();

create index if not exists idx_piggy_savings_tx_account
  on public.piggy_savings_transactions (savings_account_id);
create index if not exists idx_piggy_savings_withdraw_req_account
  on public.piggy_savings_withdraw_requests (savings_account_id);
