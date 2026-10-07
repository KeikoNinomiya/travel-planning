-- たびしおり データベース定義
-- Supabase ダッシュボードの「SQL Editor」に貼り付けて、一度だけ実行してください。

create extension if not exists pgcrypto;

-- ============ テーブル ============

create table if not exists public.trips (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 100),
  start_date  date not null,
  num_days    int  not null default 3 check (num_days between 1 and 30),
  day_titles  text[] not null default '{}',
  owner_id    uuid not null default auth.uid() references auth.users on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.trip_members (
  trip_id    uuid not null references public.trips on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null default 'editor' check (role in ('owner', 'editor')),
  email      text,
  joined_at  timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.stops (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips on delete cascade,
  day_index   int  not null check (day_index >= 0),
  position    double precision not null default 0,
  time        text,
  name        text not null check (char_length(name) between 1 and 200),
  category    text not null default '観光' check (category in ('観光','食事','移動','宿泊','買い物')),
  cost        int  not null default 0 check (cost >= 0),
  note        text not null default '',
  lat         double precision,
  lng         double precision,
  created_by  uuid default auth.uid() references auth.users on delete set null,
  updated_at  timestamptz not null default now()
);
create index if not exists stops_trip_idx on public.stops (trip_id, day_index, position);

create table if not exists public.trip_invites (
  token       text primary key default encode(gen_random_bytes(16), 'hex'),
  trip_id     uuid not null references public.trips on delete cascade,
  created_by  uuid default auth.uid() references auth.users on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days'
);

-- ============ 補助関数・トリガー ============

create or replace function public.is_member(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trip_members where trip_id = t and user_id = auth.uid());
$$;

-- 旅行を作った人を自動でオーナーとしてメンバー登録
create or replace function public.add_owner_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.trip_members (trip_id, user_id, role, email)
  values (new.id, new.owner_id, 'owner', auth.jwt() ->> 'email')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists trips_add_owner on public.trips;
create trigger trips_add_owner after insert on public.trips
  for each row execute function public.add_owner_member();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trips_touch on public.trips;
create trigger trips_touch before update on public.trips for each row execute function public.touch_updated_at();
drop trigger if exists stops_touch on public.stops;
create trigger stops_touch before update on public.stops for each row execute function public.touch_updated_at();

-- 招待リンクの情報（参加前に旅行名を表示する用）
create or replace function public.invite_info(p_token text)
returns table (trip_id uuid, title text, start_date date, num_days int, already_member boolean)
language sql stable security definer set search_path = public as $$
  select t.id, t.title, t.start_date, t.num_days, public.is_member(t.id)
  from public.trip_invites i join public.trips t on t.id = i.trip_id
  where i.token = p_token and i.expires_at > now() and auth.uid() is not null;
$$;

-- 招待リンクで参加
create or replace function public.accept_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_trip uuid;
begin
  if auth.uid() is null then raise exception 'ログインが必要です'; end if;
  select trip_id into v_trip from public.trip_invites where token = p_token and expires_at > now();
  if v_trip is null then raise exception '招待リンクが無効か、期限切れです'; end if;
  insert into public.trip_members (trip_id, user_id, role, email)
  values (v_trip, auth.uid(), 'editor', auth.jwt() ->> 'email')
  on conflict do nothing;
  return v_trip;
end $$;

-- ============ 行レベルセキュリティ ============

alter table public.trips        enable row level security;
alter table public.trip_members enable row level security;
alter table public.stops        enable row level security;
alter table public.trip_invites enable row level security;

drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select
  using (owner_id = auth.uid() or public.is_member(id));
drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips for insert
  with check (owner_id = auth.uid());
drop policy if exists trips_update on public.trips;
create policy trips_update on public.trips for update
  using (public.is_member(id)) with check (public.is_member(id));
drop policy if exists trips_delete on public.trips;
create policy trips_delete on public.trips for delete
  using (owner_id = auth.uid());

drop policy if exists members_select on public.trip_members;
create policy members_select on public.trip_members for select
  using (public.is_member(trip_id));
drop policy if exists members_delete on public.trip_members;
create policy members_delete on public.trip_members for delete
  using (
    (user_id = auth.uid() and role <> 'owner')
    or exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid() and role <> 'owner')
  );

drop policy if exists stops_all on public.stops;
create policy stops_all on public.stops for all
  using (public.is_member(trip_id)) with check (public.is_member(trip_id));

drop policy if exists invites_select on public.trip_invites;
create policy invites_select on public.trip_invites for select using (public.is_member(trip_id));
drop policy if exists invites_insert on public.trip_invites;
create policy invites_insert on public.trip_invites for insert with check (public.is_member(trip_id));
drop policy if exists invites_delete on public.trip_invites;
create policy invites_delete on public.trip_invites for delete using (public.is_member(trip_id));

grant execute on function public.invite_info(text)   to authenticated;
grant execute on function public.accept_invite(text) to authenticated;

-- ============ リアルタイム（共同編集の即時反映） ============

alter table public.stops replica identity full;
do $$
begin
  begin alter publication supabase_realtime add table public.stops; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.trips; exception when duplicate_object then null; end;
end $$;
