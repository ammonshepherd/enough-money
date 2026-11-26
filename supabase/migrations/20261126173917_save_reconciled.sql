-- v0.53.0: the transaction form can mark a transaction reconciled when it is
-- added or edited (still only a mark: no budget math).
--
-- save_transaction takes p_reconciled (null = keep the mark; a new
-- transaction is not reconciled). save_transfer: a side may carry
-- "reconciled" (true or false); a side without it keeps its mark.
-- Existing rows are not changed.

drop function public.save_transaction(uuid, uuid, date, bigint, text, text, boolean, boolean,
                                      jsonb, uuid[]);

create function public.save_transaction(
  p_id uuid,
  p_account_id uuid,
  p_date date,
  p_amount bigint,
  p_payee text,
  p_memo text,
  p_is_transfer boolean,
  p_is_income boolean default false,
  p_allocations jsonb default '[]'::jsonb,
  p_tag_ids uuid[] default null,
  p_reconciled boolean default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_household uuid;
  v_id uuid := p_id;
  v_lines jsonb := coalesce(p_allocations, '[]'::jsonb);
begin
  if p_is_transfer then
    raise exception 'Transfers are saved with both sides at once (save_transfer)'
      using errcode = '22023';
  end if;
  if jsonb_typeof(v_lines) <> 'array' then
    raise exception 'Split lines must be a list' using errcode = '22023';
  end if;
  if jsonb_array_length(v_lines) > 50 then
    raise exception 'Split into at most 50 envelopes' using errcode = '22023';
  end if;
  if (select count(distinct x.category_id) <> count(*)
      from jsonb_to_recordset(v_lines) as x(category_id uuid)) then
    raise exception 'Each envelope can appear only once in a split' using errcode = '22023';
  end if;
  if p_is_income and (p_amount <= 0 or jsonb_array_length(v_lines) > 0) then
    raise exception 'Income is money coming in, without an envelope' using errcode = '22023';
  end if;
  select household_id into v_household from public.accounts where id = p_account_id;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;

  if v_id is null then
    insert into public.transactions
      (household_id, account_id, date, amount, payee, memo, is_transfer, is_income, reconciled)
    values (v_household, p_account_id, p_date, p_amount, p_payee, p_memo, false, p_is_income,
            coalesce(p_reconciled, false))
    returning id into v_id;
  else
    perform private.release_transfer(v_id);
    -- Remove the old allocations first so the balance check never sees the
    -- new amount next to the old split.
    delete from public.transaction_allocations where transaction_id = v_id;
    update public.transactions
      set account_id = p_account_id, date = p_date, amount = p_amount,
          payee = p_payee, memo = p_memo, is_transfer = false, is_income = p_is_income,
          reconciled = coalesce(p_reconciled, reconciled)
      where id = v_id and household_id = v_household;
    if not found then
      raise exception 'Transaction not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.transaction_allocations (household_id, transaction_id, category_id, amount)
  select v_household, v_id, x.category_id, x.amount
  from jsonb_to_recordset(v_lines) as x(category_id uuid, amount bigint);
  perform private.set_transaction_tags(v_household, v_id, p_tag_ids);
  return v_id;
end;
$$;

revoke all on function public.save_transaction(uuid, uuid, date, bigint, text, text, boolean,
                                               boolean, jsonb, uuid[], boolean) from public, anon;
grant execute on function public.save_transaction(uuid, uuid, date, bigint, text, text, boolean,
                                                  boolean, jsonb, uuid[], boolean)
  to authenticated;

create or replace function public.save_transfer(p_transfer_id uuid, p_legs jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_transfer uuid := coalesce(p_transfer_id, gen_random_uuid());
  v_household uuid;
  v_leg_household uuid;
  v_leg jsonb;
  v_id uuid;
  v_ids uuid[];
  v_old uuid;
begin
  if jsonb_typeof(p_legs) is distinct from 'array' or jsonb_array_length(p_legs) <> 2 then
    raise exception 'A transfer has exactly two sides' using errcode = '22023';
  end if;

  for v_leg in select value from jsonb_array_elements(p_legs) loop
    if jsonb_typeof(v_leg) is distinct from 'object'
       or v_leg->>'account_id' is null or v_leg->>'date' is null or v_leg->>'amount' is null then
      raise exception 'Each side needs an account, a date and an amount' using errcode = '22023';
    end if;
    if v_leg ? 'tag_ids' and jsonb_typeof(v_leg->'tag_ids') is distinct from 'array' then
      raise exception 'A side''s tags must be a list' using errcode = '22023';
    end if;
    if v_leg ? 'reconciled' and jsonb_typeof(v_leg->'reconciled') is distinct from 'boolean' then
      raise exception 'A side''s reconciled mark must be true or false' using errcode = '22023';
    end if;
    select household_id into v_leg_household
      from public.accounts
      where id = (v_leg->>'account_id')::uuid and closed_at is null;
    if not found then
      raise exception 'Account not found or closed' using errcode = 'P0002';
    end if;
    if v_household is null then
      v_household := v_leg_household;
    elsif v_household <> v_leg_household then
      raise exception 'Both accounts must be in the same household' using errcode = '22023';
    end if;
  end loop;

  if p_transfer_id is not null and exists (
    select 1 from public.transactions
    where transfer_id = p_transfer_id and household_id <> v_household
  ) then
    raise exception 'Transfer not found' using errcode = 'P0002';
  end if;

  v_ids := array(
    select (value->>'id')::uuid from jsonb_array_elements(p_legs) where value->>'id' is not null
  );
  if exists (
    select 1 from public.transactions
    where id = any (v_ids) and transfer_id is not null and transfer_id <> v_transfer
  ) then
    raise exception 'That transaction is already part of another transfer'
      using errcode = '22023';
  end if;

  -- Sides this transfer had that it no longer has.
  for v_old in
    select id from public.transactions
    where transfer_id = v_transfer and not (id = any (v_ids))
  loop
    update public.transactions set transfer_id = null, is_transfer = false where id = v_old;
    delete from public.transactions where id = v_old and source = 'manual';
  end loop;

  for v_leg in select value from jsonb_array_elements(p_legs) loop
    v_id := (v_leg->>'id')::uuid;
    if v_id is null then
      insert into public.transactions
        (household_id, account_id, date, amount, payee, memo, is_transfer, transfer_id,
         reconciled)
      values (
        v_household, (v_leg->>'account_id')::uuid, (v_leg->>'date')::date,
        (v_leg->>'amount')::bigint, coalesce(v_leg->>'payee', ''),
        coalesce(v_leg->>'memo', ''), true, v_transfer,
        coalesce((v_leg->>'reconciled')::boolean, false)
      )
      returning id into v_id;
    else
      delete from public.transaction_allocations where transaction_id = v_id;
      update public.transactions
        set account_id = (v_leg->>'account_id')::uuid,
            date = (v_leg->>'date')::date,
            amount = (v_leg->>'amount')::bigint,
            payee = coalesce(v_leg->>'payee', ''),
            memo = coalesce(v_leg->>'memo', ''),
            is_transfer = true,
            transfer_id = v_transfer,
            reconciled = coalesce((v_leg->>'reconciled')::boolean, reconciled)
        where id = v_id and household_id = v_household;
      if not found then
        raise exception 'Transaction not found' using errcode = 'P0002';
      end if;
    end if;
    if v_leg ? 'tag_ids' then
      perform private.set_transaction_tags(
        v_household, v_id,
        array(select jsonb_array_elements_text(v_leg->'tag_ids'))::uuid[]
      );
    end if;
  end loop;
  return v_transfer;
end;
$$;
