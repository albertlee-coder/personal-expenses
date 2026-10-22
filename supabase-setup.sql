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

-- ===================== Expense posts =====================
-- Posts are things you keep spending on, like a car or a house. An expense can point to one,
-- and posts with needs_counter = true also ask for a reading (odometer km, electricity meter kWh...).
create table if not exists public.posts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null,
  needs_counter  boolean not null default false,
  counter_label  text not null default '',
  counter_unit   text not null default '',
  created_at     timestamptz not null default now(),
  unique (user_id, name)
);
alter table public.posts enable row level security;
drop policy if exists "own posts" on public.posts;
create policy "own posts" on public.posts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Which post an expense belongs to (optional) and the counter reading at that moment
alter table public.expenses add column if not exists post_id uuid references public.posts (id) on delete set null;
alter table public.expenses add column if not exists counter numeric;

-- ===================== Profile photos =====================
-- A public storage bucket for profile photos. Each person may only add, change or delete files
-- in their own folder (named after their user id); anyone with the link can view a photo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "own avatar" on storage.objects;
create policy "own avatar" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

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

-- ===================== Protein (Meals) =====================
-- Protein per serving in My foods, and the protein total of each record.
alter table public.foods add column if not exists protein_g numeric;
alter table public.meals add column if not exists protein_g numeric;
-- Fill in the starting foods that every account got, then past records from their food (only where still empty)
update public.foods f set protein_g = v.p
  from (values
    ('Nasi putih', 4),
    ('Nasi goreng', 12),
    ('Mie goreng instan', 8),
    ('Roti tawar', 5),
    ('Telur (rebus/ceplok)', 6),
    ('Ayam goreng', 20),
    ('Rendang daging', 15),
    ('Sate ayam', 25),
    ('Bakso', 15),
    ('Soto ayam', 15),
    ('Udang', 20),
    ('Ikan bakar', 22),
    ('Tempe goreng', 10),
    ('Tahu goreng', 6),
    ('Sayur (tumis/bening)', 2),
    ('Gorengan', 2),
    ('Martabak manis', 5),
    ('Pisang', 1.3),
    ('Es teh manis', 0),
    ('Kopi susu gula aren', 5),
    ('Kopi hitam tanpa gula', 0),
    ('Susu UHT full cream', 8),
    ('Air putih', 0)
  ) as v(name, p)
  where f.name = v.name and f.protein_g is null;
update public.foods set protein_g = 0 where protein_g is null;
update public.meals m set protein_g = round(f.protein_g * m.servings, 1)
  from public.foods f
  where m.food_id = f.id and m.protein_g is null;
update public.meals set protein_g = 0 where protein_g is null;
alter table public.foods alter column protein_g set default 0, alter column protein_g set not null;
alter table public.meals alter column protein_g set default 0, alter column protein_g set not null;

-- ===================== Strava details (Exercise → Strava month) =====================
-- Climbing and average heart rate from Strava. Workouts you record yourself leave them empty.
alter table public.workouts add column if not exists elevation_m numeric;
alter table public.workouts add column if not exists avg_hr numeric;
-- Lets the strava function fill in these details once for activities copied before they existed
alter table public.strava_tokens add column if not exists details_filled boolean not null default false;

-- ===================== Body =====================
-- Your profile: the normal ranges depend on it. One row per person.
create table if not exists public.body_profile (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() unique references auth.users (id) on delete cascade,
  height_cm   numeric,
  birth_date  date,
  sex         text,
  ethnicity   text,
  created_at  timestamptz not null default now()
);

-- One row per measurement from a body-composition scale. Every number is optional.
create table if not exists public.body_measurements (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date                 date not null,
  weight_kg            numeric,
  body_fat_pct         numeric,
  muscle_pct           numeric,
  visceral_fat         integer,
  protein_pct          numeric,
  body_water_pct       numeric,
  bone_kg              numeric,
  skeletal_muscle_pct  numeric,
  note                 text not null default '',
  created_at           timestamptz not null default now()
);
create index if not exists body_measurements_user_date on public.body_measurements (user_id, date desc);

do $$
declare t text;
begin
  foreach t in array array['body_profile', 'body_measurements'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
