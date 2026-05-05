create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id text not null,
  cleanliness numeric not null check (cleanliness >= 0 and cleanliness <= 100),
  score integer not null check (score >= 0),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists game_sessions_household_id_idx
  on public.game_sessions (household_id);

create index if not exists game_sessions_completed_at_idx
  on public.game_sessions (completed_at desc);
