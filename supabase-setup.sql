-- Personal Superapp: database setup for Supabase
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- It is safe to run more than once: it only adds what is missing and never deletes your data.

-- ===================== Expenses =====================

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

-- Each person's own list of payment methods (CASH, QRIS, credit cards...), in their order.
-- The app fills in the starting list the first time each person logs in.
create table if not exists public.payment_methods (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  position    integer not null default 0,
  unique (user_id, name)
);

-- Which payment method an expense was paid with. Optional: older expenses simply have none.
alter table public.expenses add column if not exists payment_method text;

create index if not exists expenses_user_date on public.expenses (user_id, date desc);

-- Row Level Security: this is what keeps your data and your wife's data apart.
-- Every query only ever sees rows whose user_id is the logged-in person.
alter table public.expenses   enable row level security;
alter table public.categories enable row level security;
alter table public.payment_methods enable row level security;

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

drop policy if exists "own payment methods" on public.payment_methods;
create policy "own payment methods" on public.payment_methods
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===================== To-do =====================
create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null,
  note        text not null default '',
  due_date    date,
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- ===================== Meals =====================
-- My foods: the foods and drinks you usually have, with rough numbers per serving
create table if not exists public.foods (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null,
  serving         text not null default '',
  kind            text not null default 'food',
  sugar_g         numeric not null default 0,
  carbs_g         numeric not null default 0,
  sat_fat_g       numeric not null default 0,
  cholesterol_mg  numeric not null default 0,
  created_at      timestamptz not null default now()
);

-- One row per food or drink you had. The numbers are the totals for the servings, copied at the time,
-- so changing a food in My foods later doesn't change past records.
create table if not exists public.meals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date            date not null,
  time            time,
  food_id         uuid references public.foods (id) on delete set null,
  name            text not null,
  servings        numeric not null default 1,
  sugar_g         numeric not null default 0,
  carbs_g         numeric not null default 0,
  sat_fat_g       numeric not null default 0,
  cholesterol_mg  numeric not null default 0,
  note            text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists meals_user_date on public.meals (user_id, date desc);

-- ===================== Exercise =====================
create table if not exists public.workouts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date          date not null,
  type          text not null,
  duration_min  integer not null default 0,
  intensity     text not null default 'moderate',
  body_parts    text[] not null default '{}',
  distance_km   numeric,
  note          text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists workouts_user_date on public.workouts (user_id, date desc);

-- The weekly plan: weekday 1 = Monday ... 7 = Sunday. Optional; a day can have several items.
create table if not exists public.exercise_plan (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weekday       smallint not null check (weekday between 1 and 7),
  title         text not null default '',
  type          text not null default '',
  body_parts    text[] not null default '{}',
  duration_min  integer,
  created_at    timestamptz not null default now()
);

-- Same privacy rule for every new table: each person only ever sees their own rows.
do $$
declare t text;
begin
  foreach t in array array['todos', 'foods', 'meals', 'workouts', 'exercise_plan'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ===================== Strava sync =====================
-- Workouts copied from Strava keep the Strava activity number, so the same activity is never added twice.
alter table public.workouts add column if not exists strava_id bigint;
create unique index if not exists workouts_user_strava on public.workouts (user_id, strava_id);

-- Each person's Strava login. Only the "strava" Edge Function reads this table: row level security is on
-- with no rules, so the app page (and anyone with the public key) can never see these tokens.
create table if not exists public.strava_tokens (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  athlete_id     bigint,
  athlete_name   text not null default '',
  access_token   text not null,
  refresh_token  text not null,
  expires_at     bigint not null,          -- when the access token runs out (seconds since 1970)
  synced_until   bigint,                   -- start time of the newest activity copied so far
  last_sync_at   timestamptz,
  created_at     timestamptz not null default now()
);
alter table public.strava_tokens enable row level security;
