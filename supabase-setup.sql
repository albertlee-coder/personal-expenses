-- Personal Expenses: database setup for Supabase
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- It is safe to run more than once.

-- One row per expense. user_id links each row to the person who is logged in.
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  amount      bigint not null check (amount > 0),
  category    text not null,
  note        text not null default '',
  created_at  timestamptz not null default now()
);

-- Each person's own list of categories, in the order they arranged them.
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  position    integer not null default 0,
  unique (user_id, name)
);

create index if not exists expenses_user_date on public.expenses (user_id, date desc);

-- Row Level Security: this is what keeps your data and your wife's data apart.
-- Every query only ever sees rows whose user_id is the logged-in person.
alter table public.expenses   enable row level security;
alter table public.categories enable row level security;

drop policy if exists "own expenses" on public.expenses;
create policy "own expenses" on public.expenses
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "own categories" on public.categories;
create policy "own categories" on public.categories
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
