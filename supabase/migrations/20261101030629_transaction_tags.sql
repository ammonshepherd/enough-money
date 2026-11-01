-- v0.39.0: transaction tags. A household keeps its own tags (a name and a
-- colour); any transaction can carry several. Tags are only labels for
-- showing and searching: they change no budget math. Each side of a transfer
-- keeps its own tags. No existing rows change.

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (name = trim(name) and length(name) between 1 and 30),
  color text not null default 'grey'
    check (color in ('grey', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple',
                     'pink')),
  created_at timestamptz not null default now(),
  unique (household_id, id)
);

-- One name per household, ignoring case.
create unique index tags_household_name_idx on public.tags (household_id, lower(name));

create table public.transaction_tags (
  household_id uuid not null,
  transaction_id uuid not null,
  tag_id uuid not null,
  primary key (transaction_id, tag_id),
  foreign key (household_id, transaction_id)
    references public.transactions (household_id, id) on delete cascade,
  foreign key (household_id, tag_id)
    references public.tags (household_id, id) on delete cascade
);

create index transaction_tags_transaction_idx
  on public.transaction_tags (household_id, transaction_id);
create index transaction_tags_tag_idx on public.transaction_tags (household_id, tag_id);

alter table public.tags enable row level security;
alter table public.transaction_tags enable row level security;

create policy member_all on public.tags
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
create policy member_all on public.transaction_tags
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

revoke all on public.tags from anon, authenticated;
grant select, insert, update, delete on public.tags to authenticated;
revoke all on public.transaction_tags from anon, authenticated;
grant select, insert, delete on public.transaction_tags to authenticated;

-- Replaces a transaction's tags (null = leave them as they are). At most 20,
-- each a tag of the transaction's household.
create function private.set_transaction_tags(p_household uuid, p_id uuid, p_tag_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_tag_ids is null then
    return;
  end if;
  if (select count(distinct t) from unnest(p_tag_ids) t) > 20 then
    raise exception 'A transaction can have at most 20 tags' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_tag_ids) t
    where t is null
       or not exists (select 1 from public.tags g where g.id = t and g.household_id = p_household)
  ) then
    raise exception 'Tag not found' using errcode = 'P0002';
  end if;
  delete from public.transaction_tags where transaction_id = p_id;
  insert into public.transaction_tags (household_id, transaction_id, tag_id)
    select distinct p_household, p_id, t from unnest(p_tag_ids) t;
end;
$$;

revoke all on function private.set_transaction_tags(uuid, uuid, uuid[]) from public, anon;
grant execute on function private.set_transaction_tags(uuid, uuid, uuid[]) to authenticated;

-- save_transaction takes the transaction's tags (null = keep them).
drop function public.save_transaction(uuid, uuid, date, bigint, text, text, boolean, boolean,
                                      jsonb);

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
  p_tag_ids uuid[] default null
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
      (household_id, account_id, date, amount, payee, memo, is_transfer, is_income)
    values (v_household, p_account_id, p_date, p_amount, p_payee, p_memo, false, p_is_income)
    returning id into v_id;
  else
    perform private.release_transfer(v_id);
    -- Remove the old allocations first so the balance check never sees the
    -- new amount next to the old split.
    delete from public.transaction_allocations where transaction_id = v_id;
    update public.transactions
      set account_id = p_account_id, date = p_date, amount = p_amount,
          payee = p_payee, memo = p_memo, is_transfer = false, is_income = p_is_income
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
                                               boolean, jsonb, uuid[]) from public, anon;
grant execute on function public.save_transaction(uuid, uuid, date, bigint, text, text, boolean,
                                                  boolean, jsonb, uuid[]) to authenticated;

-- save_transfer: a side may carry "tag_ids" (a list); a side without it keeps its tags.
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
        (household_id, account_id, date, amount, payee, memo, is_transfer, transfer_id)
      values (
        v_household, (v_leg->>'account_id')::uuid, (v_leg->>'date')::date,
        (v_leg->>'amount')::bigint, coalesce(v_leg->>'payee', ''),
        coalesce(v_leg->>'memo', ''), true, v_transfer
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
            transfer_id = v_transfer
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

-- Adds a tag to (p_on) or removes it from several transactions in one step.
-- Row Level Security limits it to the caller's household; transactions that
-- already have it (or already have 20 tags) are left alone when adding.
-- Resolves to how many changed.
create function public.tag_transactions(p_ids uuid[], p_tag_id uuid, p_on boolean)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_household uuid;
  v_count integer;
begin
  if coalesce(array_length(p_ids, 1), 0) > 2000 then
    raise exception 'Tag at most 2000 transactions at once' using errcode = '22023';
  end if;
  select household_id into v_household from public.tags where id = p_tag_id;
  if not found then
    raise exception 'Tag not found' using errcode = 'P0002';
  end if;
  if p_on then
    insert into public.transaction_tags (household_id, transaction_id, tag_id)
      select v_household, t.id, p_tag_id
      from public.transactions t
      where t.id = any (p_ids) and t.household_id = v_household
        and (select count(*) from public.transaction_tags x where x.transaction_id = t.id) < 20
    on conflict do nothing;
  else
    delete from public.transaction_tags
      where tag_id = p_tag_id and transaction_id = any (p_ids);
  end if;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.tag_transactions(uuid[], uuid, boolean) from public, anon;
grant execute on function public.tag_transactions(uuid[], uuid, boolean) to authenticated;

-- Backups carry tags and which transactions have them. Files without these
-- lists (made before v0.39.0) still restore, with no tags.
create or replace function public.export_backup(p_household_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not private.is_household_member(p_household_id) then
    raise exception 'You are not a member of this household' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'format', 'budget-buddy-backup',
    'version', 1,
    'exported_at', now(),
    'household', (select jsonb_build_object('name', h.name)
                    from public.households h where h.id = p_household_id),
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'name', a.name, 'type', a.type,
        'opening_balance', a.opening_balance, 'opening_date', a.opening_date,
        'on_budget', a.on_budget, 'closed_at', a.closed_at,
        'import_format', a.import_format, 'created_at', a.created_at
      ) order by a.created_at, a.id)
      from public.accounts a where a.household_id = p_household_id), '[]'::jsonb),
    'category_groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'name', g.name, 'position', g.position, 'created_at', g.created_at
      ) order by g.position, g.id)
      from public.category_groups g where g.household_id = p_household_id), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'group_id', c.group_id, 'name', c.name, 'position', c.position,
        'card_account_id', c.card_account_id, 'created_at', c.created_at
      ) order by c.group_id, c.position, c.id)
      from public.categories c where c.household_id = p_household_id), '[]'::jsonb),
    'category_months', coalesce((
      select jsonb_agg(jsonb_build_object(
        'category_id', m.category_id, 'month', m.month, 'assigned', m.assigned,
        'released', m.released, 'planned', m.planned
      ) order by m.month, m.category_id)
      from public.category_months m where m.household_id = p_household_id), '[]'::jsonb),
    'transactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'account_id', t.account_id, 'date', t.date, 'amount', t.amount,
        'payee', t.payee, 'memo', t.memo, 'is_transfer', t.is_transfer,
        'is_income', t.is_income, 'transfer_id', t.transfer_id, 'voided', t.voided,
        'import_key', t.import_key, 'reconciled', t.reconciled, 'source', t.source,
        'created_at', t.created_at
      ) order by t.date, t.created_at, t.id)
      from public.transactions t where t.household_id = p_household_id), '[]'::jsonb),
    'transaction_allocations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'transaction_id', x.transaction_id, 'category_id', x.category_id, 'amount', x.amount
      ) order by x.transaction_id, x.category_id)
      from public.transaction_allocations x where x.household_id = p_household_id),
      '[]'::jsonb),
    'income_rules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pattern', r.pattern, 'account_id', r.account_id, 'created_at', r.created_at
      ) order by r.created_at, r.id)
      from public.income_rules r where r.household_id = p_household_id), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'name', g.name, 'color', g.color, 'created_at', g.created_at
      ) order by g.created_at, g.id)
      from public.tags g where g.household_id = p_household_id), '[]'::jsonb),
    'transaction_tags', coalesce((
      select jsonb_agg(jsonb_build_object(
        'transaction_id', x.transaction_id, 'tag_id', x.tag_id
      ) order by x.transaction_id, x.tag_id)
      from public.transaction_tags x where x.household_id = p_household_id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.restore_backup(p_household_id uuid, p_backup jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_key text;
begin
  if not private.is_household_member(p_household_id) then
    raise exception 'You are not a member of this household' using errcode = '42501';
  end if;
  if jsonb_typeof(p_backup) <> 'object'
     or p_backup->>'format' is distinct from 'budget-buddy-backup'
     or p_backup->>'version' is distinct from '1' then
    raise exception 'That is not a Budget Buddy backup this version can read'
      using errcode = '22023';
  end if;
  foreach v_key in array array['accounts', 'category_groups', 'categories', 'category_months',
                               'transactions', 'transaction_allocations', 'income_rules'] loop
    if jsonb_typeof(p_backup->v_key) is distinct from 'array' then
      raise exception 'The backup is missing its % list', v_key using errcode = '22023';
    end if;
  end loop;
  -- Optional: files from before v0.39.0 have no tags.
  foreach v_key in array array['tags', 'transaction_tags'] loop
    if p_backup ? v_key and jsonb_typeof(p_backup->v_key) is distinct from 'array' then
      raise exception 'The backup''s % list is not a list', v_key using errcode = '22023';
    end if;
  end loop;
  if exists (select 1 from public.accounts where household_id = p_household_id)
     or exists (select 1 from public.category_groups where household_id = p_household_id)
     or exists (select 1 from public.categories where household_id = p_household_id)
     or exists (select 1 from public.category_months where household_id = p_household_id)
     or exists (select 1 from public.transactions where household_id = p_household_id)
     or exists (select 1 from public.income_rules where household_id = p_household_id)
     or exists (select 1 from public.tags where household_id = p_household_id) then
    raise exception 'A backup can only be restored into an empty household'
      using errcode = '22023';
  end if;

  update public.households
    set name = left(trim(p_backup->'household'->>'name'), 100)
    where id = p_household_id
      and length(trim(coalesce(p_backup->'household'->>'name', ''))) > 0;

  insert into public.category_groups (id, household_id, name, position, created_at)
    select x.id, p_household_id, x.name, x.position, coalesce(x.created_at, now())
    from jsonb_to_recordset(p_backup->'category_groups')
      as x(id uuid, name text, position integer, created_at timestamptz);

  -- Closed for now, so the payment envelopes the trigger adds can be removed.
  insert into public.accounts (id, household_id, name, type, opening_balance, opening_date,
                               on_budget, closed_at, import_format, created_at)
    select x.id, p_household_id, x.name, x.type, x.opening_balance, x.opening_date,
           coalesce(x.on_budget, true), now(), x.import_format, coalesce(x.created_at, now())
    from jsonb_to_recordset(p_backup->'accounts')
      as x(id uuid, name text, type text, opening_balance bigint, opening_date date,
           on_budget boolean, import_format jsonb, created_at timestamptz);

  delete from public.categories
    where household_id = p_household_id and card_account_id is not null;
  delete from public.category_groups g
    where g.household_id = p_household_id
      and g.id not in (select (e->>'id')::uuid
                         from jsonb_array_elements(p_backup->'category_groups') e);

  insert into public.categories (id, household_id, group_id, name, position, card_account_id,
                                 created_at)
    select x.id, p_household_id, x.group_id, x.name, x.position, x.card_account_id,
           coalesce(x.created_at, now())
    from jsonb_to_recordset(p_backup->'categories')
      as x(id uuid, group_id uuid, name text, position integer, card_account_id uuid,
           created_at timestamptz);

  insert into public.category_months (household_id, category_id, month, assigned, released,
                                      planned)
    select p_household_id, x.category_id, x.month, coalesce(x.assigned, 0),
           coalesce(x.released, 0), coalesce(x.planned, 0)
    from jsonb_to_recordset(p_backup->'category_months')
      as x(category_id uuid, month text, assigned bigint, released bigint, planned bigint);

  insert into public.transactions (id, household_id, account_id, date, amount, payee, memo,
                                   is_transfer, is_income, transfer_id, voided, import_key,
                                   reconciled, source, created_at)
    select x.id, p_household_id, x.account_id, x.date, x.amount, coalesce(x.payee, ''),
           coalesce(x.memo, ''), coalesce(x.is_transfer, false), coalesce(x.is_income, false),
           x.transfer_id, coalesce(x.voided, false), x.import_key,
           coalesce(x.reconciled, false), coalesce(x.source, 'manual'),
           coalesce(x.created_at, now())
    from jsonb_to_recordset(p_backup->'transactions')
      as x(id uuid, account_id uuid, date date, amount bigint, payee text, memo text,
           is_transfer boolean, is_income boolean, transfer_id uuid, voided boolean,
           import_key text, reconciled boolean, source text, created_at timestamptz);

  insert into public.transaction_allocations (household_id, transaction_id, category_id, amount)
    select p_household_id, x.transaction_id, x.category_id, x.amount
    from jsonb_to_recordset(p_backup->'transaction_allocations')
      as x(transaction_id uuid, category_id uuid, amount bigint);

  insert into public.income_rules (household_id, pattern, account_id, created_at)
    select p_household_id, x.pattern, x.account_id, coalesce(x.created_at, now())
    from jsonb_to_recordset(p_backup->'income_rules')
      as x(pattern text, account_id uuid, created_at timestamptz);

  insert into public.tags (id, household_id, name, color, created_at)
    select x.id, p_household_id, x.name, coalesce(x.color, 'grey'), coalesce(x.created_at, now())
    from jsonb_to_recordset(coalesce(p_backup->'tags', '[]'::jsonb))
      as x(id uuid, name text, color text, created_at timestamptz);

  insert into public.transaction_tags (household_id, transaction_id, tag_id)
    select p_household_id, x.transaction_id, x.tag_id
    from jsonb_to_recordset(coalesce(p_backup->'transaction_tags', '[]'::jsonb))
      as x(transaction_id uuid, tag_id uuid);

  update public.accounts a
    set closed_at = x.closed_at
    from jsonb_to_recordset(p_backup->'accounts') as x(id uuid, closed_at timestamptz)
    where a.id = x.id and a.household_id = p_household_id;

  -- Run the deferred checks now (transfer pairs, split sums), so a broken
  -- file fails here with a readable message instead of at commit.
  set constraints all immediate;
end;
$$;
