-- v0.54.0: ticked transactions in an open account can be deleted, moved to
-- another account or given a new date, all at once (batchEdits.ts). Each
-- function is all or nothing: only basic transactions (in an open account,
-- not a transfer, not a split), and a list naming any other, or one the
-- caller cannot see, changes nothing. Budget checks (no envelope below
-- $0.00, never further Over Assigned) stay in budgetMath.ts, as for single
-- edits. Existing rows are not changed.

-- The shared check: the transactions, each found, basic and in an open account.
create function private.batch_transactions(p_ids uuid[])
returns setof public.transactions
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_ids uuid[] := array(select distinct x from unnest(coalesce(p_ids, '{}')) as x);
begin
  if cardinality(v_ids) > 2000 then
    raise exception 'Change at most 2000 transactions at once' using errcode = '22023';
  end if;
  if (select count(*) from public.transactions where id = any (v_ids)) <> cardinality(v_ids) then
    raise exception 'A ticked transaction has changed or is gone. Tick them again.'
      using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.transactions t
    where t.id = any (v_ids)
      and (t.is_transfer
           or (select count(*) from public.transaction_allocations a
               where a.transaction_id = t.id) > 1)
  ) then
    raise exception 'Transfers and splits are changed one at a time' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.transactions t
    join public.accounts a on a.id = t.account_id
    where t.id = any (v_ids) and a.closed_at is not null
  ) then
    raise exception 'Transactions in a closed account cannot be changed' using errcode = '22023';
  end if;
  return query select * from public.transactions where id = any (v_ids);
end;
$$;

revoke all on function private.batch_transactions(uuid[]) from public, anon;
grant execute on function private.batch_transactions(uuid[]) to authenticated;

-- Deletes them (allocations and tags cascade). Imported rows go too, with
-- their import key: the next bank file covering their dates adds them again.
create function public.delete_transactions(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.transactions
    where id in (select b.id from private.batch_transactions(p_ids) b);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.delete_transactions(uuid[]) from public, anon;
grant execute on function public.delete_transactions(uuid[]) to authenticated;

-- Moves typed-in transactions to another open account of the same kind
-- (type and on_budget), never dated before it opened. Envelopes, Income,
-- tags and the reconciled mark stay.
create function public.move_transactions(p_ids uuid[], p_account_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_target public.accounts;
  v_ids uuid[];
  v_count integer;
begin
  v_ids := array(select b.id from private.batch_transactions(p_ids) b);

  select * into v_target from public.accounts where id = p_account_id and closed_at is null;
  if not found or exists (
    select 1 from public.transactions t
    join public.accounts a on a.id = t.account_id
    where t.id = any (v_ids)
      and (a.household_id <> v_target.household_id
       or a.type <> v_target.type or a.on_budget <> v_target.on_budget)
  ) then
    raise exception 'Move to another open account of the same kind' using errcode = '22023';
  end if;
  if exists (select 1 from public.transactions where id = any (v_ids) and import_key is not null) then
    raise exception 'Only transactions typed in (not imported) can move to another account'
      using errcode = '22023';
  end if;
  if exists (select 1 from public.transactions
             where id = any (v_ids) and date < v_target.opening_date) then
    raise exception 'A transaction cannot be dated before its account opened'
      using errcode = '22023';
  end if;

  update public.transactions
    set account_id = p_account_id
    where id = any (v_ids) and account_id <> p_account_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.move_transactions(uuid[], uuid) from public, anon;
grant execute on function public.move_transactions(uuid[], uuid) to authenticated;

-- Gives them all one new date, never before their account opened.
create function public.redate_transactions(p_ids uuid[], p_date date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_count integer;
begin
  if p_date is null then
    raise exception 'Choose a date' using errcode = '22023';
  end if;
  v_ids := array(select b.id from private.batch_transactions(p_ids) b);

  if exists (
    select 1 from public.transactions t
    join public.accounts a on a.id = t.account_id
    where t.id = any (v_ids) and p_date < a.opening_date
  ) then
    raise exception 'A transaction cannot be dated before its account opened'
      using errcode = '22023';
  end if;

  update public.transactions
    set date = p_date
    where id = any (v_ids) and date <> p_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.redate_transactions(uuid[], date) from public, anon;
grant execute on function public.redate_transactions(uuid[], date) to authenticated;
