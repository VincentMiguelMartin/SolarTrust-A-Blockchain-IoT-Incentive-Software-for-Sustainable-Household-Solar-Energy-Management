create table if not exists public.store_purchases (
  id uuid primary key default gen_random_uuid(),
  household_id text not null,
  item_key text not null,
  item_name text not null,
  cost integer not null check (cost > 0),
  purchased_at timestamptz not null default now()
);

create index if not exists store_purchases_household_id_idx
  on public.store_purchases (household_id);

create index if not exists store_purchases_purchased_at_idx
  on public.store_purchases (purchased_at desc);
