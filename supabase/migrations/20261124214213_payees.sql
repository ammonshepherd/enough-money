-- v0.45.0: saved payees. A household keeps a list of its payees, offered as
-- suggestions while typing a payee in the transaction form. A transaction
-- still keeps its payee as text (no link to the list): the list only
-- remembers names. A payee typed in the form joins the list (a trigger:
-- a typed transaction, or any whose payee is changed); payees of imported
-- rows (bank descriptions) and of transfers do not. Renaming a payee
-- renames it on every transaction (renaming it to another payee's name
-- merges the two); deleting one only takes it off the list. Changes no
-- budget math. Backups carry the list.
--
-- Existing rows: the list starts with the payees of typed (source manual),
-- non-transfer transactions, one per name ignoring case, spelled as on the
-- newest of them. No transaction changes.

create table public.payees (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (name = trim(name) and length(name) between 1 and 200),
  created_at timestamptz not null default now()
);

-- One name per household, ignoring case.
create unique index payees_household_name_idx on public.payees (household_id, lower(name));

alter table public.payees enable row level security;

create policy member_all on public.payees
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

revoke all on public.payees from anon, authenticated;
grant select, insert, update, delete on public.payees to authenticated;

-- Adds a typed payee to the list: on a new typed transaction, or when a
-- transaction's payee changes (the form saving an imported row, a rename).
-- Never for transfers or a blank payee; a name already listed (ignoring
-- case) is left as it is.
create function public.remember_payee()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.is_transfer or trim(new.payee) = '' then
    return null;
  end if;
  if tg_op = 'INSERT' and new.source <> 'manual' then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.payee is not distinct from old.payee then
    return null;
  end if;
  insert into public.payees (household_id, name)
    values (new.household_id, trim(new.payee))
    on conflict (household_id, lower(name)) do nothing;
  return null;
end;
$$;

create trigger transactions_remember_payee
  after insert or update of payee on public.transactions
  for each row execute function public.remember_payee();

revoke execute on function public.remember_payee() from public, anon, authenticated;

-- Renames a payee and every transaction with its name (ignoring case and
-- spaces at the ends). A name another payee has already (ignoring case)
-- merges them: one payee is left, spelled as typed, and the transactions of
-- both carry that spelling. Resolves to the id of the payee that is left.
create function public.rename_payee(p_id uuid, p_name text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_household uuid;
  v_old text;
  v_keep uuid;
begin
  if length(v_name) not between 1 and 200 then
    raise exception 'A payee name is 1 to 200 characters' using errcode = '22023';
  end if;
  select household_id, name into v_household, v_old from public.payees where id = p_id;
  if not found then
    raise exception 'Payee not found' using errcode = 'P0002';
  end if;
  select id into v_keep from public.payees
    where household_id = v_household and lower(name) = lower(v_name) and id <> p_id;
  if v_keep is null then
    v_keep := p_id;
  else
    delete from public.payees where id = p_id;
  end if;
  -- The list first, so the transactions' trigger finds the new name listed.
  update public.payees set name = v_name where id = v_keep;
  update public.transactions
    set payee = v_name
    where household_id = v_household
      and lower(trim(payee)) in (lower(v_old), lower(v_name))
      and payee <> v_name;
  return v_keep;
end;
$$;

revoke all on function public.rename_payee(uuid, text) from public, anon;
grant execute on function public.rename_payee(uuid, text) to authenticated;

-- The list starts with the payees already typed.
insert into public.payees (household_id, name)
  select distinct on (household_id, lower(trim(payee))) household_id, trim(payee)
  from public.transactions
  where source = 'manual' and not is_transfer and trim(payee) <> ''
  order by household_id, lower(trim(payee)), date desc, created_at desc, id desc
  on conflict do nothing;

-- Backups carry payees. A file without the list (made before v0.45.0)
-- restores with the payees of its typed transactions (the trigger).
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
      from public.transaction_tags x where x.household_id = p_household_id), '[]'::jsonb),
    'envelope_goals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'category_id', g.category_id, 'amount', g.amount, 'goal_date', g.goal_date,
        'archived_at', g.archived_at, 'created_at', g.created_at
      ) order by g.created_at, g.id)
      from public.envelope_goals g where g.household_id = p_household_id), '[]'::jsonb),
    'payees', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', p.name, 'created_at', p.created_at
      ) order by lower(p.name), p.id)
      from public.payees p where p.household_id = p_household_id), '[]'::jsonb)
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
  -- Optional: files from before v0.39.0 have no tags, before v0.44.0 no
  -- goals, before v0.45.0 no payees.
  foreach v_key in array array['tags', 'transaction_tags', 'envelope_goals', 'payees'] loop
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
     or exists (select 1 from public.tags where household_id = p_household_id)
     or exists (select 1 from public.payees where household_id = p_household_id) then
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

  insert into public.envelope_goals (household_id, category_id, amount, goal_date, archived_at,
                                     created_at)
    select p_household_id, x.category_id, x.amount, x.goal_date, x.archived_at,
           coalesce(x.created_at, now())
    from jsonb_to_recordset(coalesce(p_backup->'envelope_goals', '[]'::jsonb))
      as x(category_id uuid, amount bigint, goal_date date, archived_at timestamptz,
           created_at timestamptz);

  -- The transactions' trigger listed their typed payees; a file with a list
  -- of its own replaces that with exactly its list.
  if p_backup ? 'payees' then
    delete from public.payees where household_id = p_household_id;
    insert into public.payees (household_id, name, created_at)
      select p_household_id, x.name, coalesce(x.created_at, now())
      from jsonb_to_recordset(p_backup->'payees') as x(name text, created_at timestamptz);
  end if;

  update public.accounts a
    set closed_at = x.closed_at
    from jsonb_to_recordset(p_backup->'accounts') as x(id uuid, closed_at timestamptz)
    where a.id = x.id and a.household_id = p_household_id;

  -- Run the deferred checks now (transfer pairs, split sums), so a broken
  -- file fails here with a readable message instead of at commit.
  set constraints all immediate;
end;
$$;
