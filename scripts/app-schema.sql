-- App shema (O1): Google login, onboarding, dashboard uštede.
-- Pokreni na istoj Vercel Postgres (Neon) bazi kao RAG:
--   psql "$POSTGRES_URL" -f scripts/app-schema.sql
-- Idempotentno: sigurno ponovno pokrenuti.
--
-- Izolacija podataka: preglednik NIKAD ne razgovara s bazom. Svaki upit ide kroz
-- api/*.js i filtrira po user_id iz potpisane session kolačića (api/_lib/session.js).
-- Testovi: tests/app-isolation.check.js.

create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  google_sub text unique not null,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),   -- datum prijave = sidro za uštede
  last_login_at timestamptz not null default now()
);

create table if not exists app_profiles (
  user_id uuid primary key references app_users(id) on delete cascade,
  onboarding_step int not null default 1 check (onboarding_step between 1 and 7),
  onboarding_completed_at timestamptz,
  birth_year int check (birth_year between 1920 and 2100),
  height_cm int check (height_cm between 120 and 230),
  weight_kg numeric(5,1) check (weight_kg between 30 and 250),
  health_consent_at timestamptz,
  goals text[] not null default '{}'
    check (goals <@ array['save_money','less_time','more_protein','portion_control','kid_friendly']
           and cardinality(goals) <= 2),
  updated_at timestamptz not null default now(),
  -- bez privole nema zdravstvenih podataka
  check (health_consent_at is not null or (birth_year is null and height_cm is null and weight_kg is null))
);

create table if not exists app_training (
  user_id uuid primary key references app_users(id) on delete cascade,
  trains boolean not null,
  training_goal text check (training_goal in ('gain_weight','build_muscle','conditioning','lose_weight')),
  plan_status text[] not null default '{}'
    check (plan_status <@ array['has_plan','has_trainer','needs_ideas','online_challenges','wants_trainer_referral']),
  trainer_mode text check (trainer_mode in ('online','in_person')),
  updated_at timestamptz not null default now(),
  check (trains or (training_goal is null and cardinality(plan_status) = 0 and trainer_mode is null)),
  check (not trains or training_goal is not null),
  check ((trainer_mode is not null) = ('wants_trainer_referral' = any(plan_status)))
);

create table if not exists app_households (
  user_id uuid primary key references app_users(id) on delete cascade,
  adults int not null default 1 check (adults between 1 and 8),
  children int not null default 0 check (children between 0 and 8),
  program text check (program in ('survivor','old_school','modern','protein_150')),
  plan_style text generated always as (case when program = 'old_school' then 'old_school' else 'modern' end) stored,
  diets text[] not null default '{}'
    check (diets <@ array['vegan','vegetarian','un_diet','keto','high_protein','low_fat','gluten_free','lactose_free']),
  allergens text[] not null default '{}'
    check (allergens <@ array['gluten','milk','eggs','fish','crustaceans','molluscs','peanuts','tree_nuts','soy','sesame','celery','mustard','lupin','sulphites']),
  dislikes text check (length(dislikes) <= 200),
  cook_days text[] not null default '{sun,wed}',
  updated_at timestamptz not null default now()
);

create table if not exists app_trainer_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  mode text not null check (mode in ('online','in_person')),
  status text not null default 'new' check (status in ('new','contacted','matched','closed')),
  created_at timestamptz not null default now()
);
-- najviše jedan otvoreni lead po korisniku
create unique index if not exists app_trainer_leads_one_open
  on app_trainer_leads (user_id) where status in ('new','contacted');

-- Piše SAMO pipeline (scripts/push-week-savings.js). Web samo čita i zbraja.
create table if not exists app_weekly_savings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),   -- ponedjeljak
  spent_eur numeric(8,2) not null check (spent_eur >= 0),
  baseline_eur numeric(8,2) not null check (baseline_eur >= 0),
  saving_promo_eur numeric(8,2) not null default 0,
  saving_store_eur numeric(8,2) not null default 0,
  source text not null default 'plan' check (source in ('plan','confirmed')),
  plan_ref text,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);
