create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_guest_id uuid not null,
  undercover_count int not null default 1,
  mrwhite_count int not null default 0,
  status text not null default 'lobby',
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  guest_id uuid not null,
  name text not null,
  is_host boolean not null default false,
  is_alive boolean not null default true,

  last_seen_at timestamptz not null default now(),

  role text,
  word text,

  created_at timestamptz not null default now(),
  unique (room_id, guest_id)
);

create index if not exists players_room_id_idx on public.players(room_id);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number int not null,
  phase text not null default 'assign',
  current_speaker_index int not null default 0,
  eliminated_player_id uuid references public.players(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (room_id, round_number)
);

create index if not exists rounds_room_id_idx on public.rounds(room_id);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  voter_guest_id uuid not null,
  target_player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (round_id, voter_guest_id)
);

create table if not exists public.readies (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  guest_id uuid not null,
  created_at timestamptz not null default now(),
  unique (round_id, guest_id)
);

create index if not exists votes_room_round_idx on public.votes(room_id, round_id);

create index if not exists readies_room_round_idx on public.readies(room_id, round_id);

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.rounds enable row level security;
alter table public.votes enable row level security;
alter table public.readies enable row level security;

drop policy if exists "rooms_no_direct_anon" on public.rooms;
create policy "rooms_no_direct_anon" on public.rooms
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "players_no_direct_anon" on public.players;
create policy "players_no_direct_anon" on public.players
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "rounds_no_direct_anon" on public.rounds;
create policy "rounds_no_direct_anon" on public.rounds
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "votes_no_direct_anon" on public.votes;
create policy "votes_no_direct_anon" on public.votes
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "readies_no_direct_anon" on public.readies;
create policy "readies_no_direct_anon" on public.readies
  for all
  to anon, authenticated
  using (false)
  with check (false);
