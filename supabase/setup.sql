-- 選考進捗ボード：Supabase の初期設定
-- 使い方：Supabase の「SQL Editor」にこのファイルの内容を全部貼り付けて「Run」
-- ★ 一番下の 'your-email@example.com' を、最初の管理者のメールアドレス（Googleログインに使うもの）に書き換えてから実行してください
-- 何度実行しても大丈夫です（すでにある物はそのまま）

-- 1) 許可メンバー（ここに登録されたメールアドレスの人だけがデータを見られる）
create table if not exists public.ra_members (
  email      text primary key,
  name       text default '',
  created_at timestamptz not null default now(),
  added_by   text default (auth.jwt() ->> 'email')
);

-- 2) アプリのデータ（すべてのデータを1つの表に JSON で保存）
create table if not exists public.ra_records (
  id         text primary key,
  kind       text not null,
  data       jsonb not null,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists ra_records_updated_at on public.ra_records (updated_at);

-- 更新日時・更新者をサーバー側で記録
create or replace function public.ra_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.jwt() ->> 'email';
  return new;
end $$;
drop trigger if exists ra_touch on public.ra_records;
create trigger ra_touch before insert or update on public.ra_records for each row execute function public.ra_touch();

-- ログイン中の人が許可メンバーか
create or replace function public.ra_is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ra_members where email = lower(auth.jwt() ->> 'email'));
$$;
revoke all on function public.ra_is_member() from public, anon;
grant execute on function public.ra_is_member() to authenticated;

-- 3) アクセス制限（RLS）：ログインしていない人・メンバー以外は何もできない
alter table public.ra_records enable row level security;
alter table public.ra_members enable row level security;

drop policy if exists ra_records_member on public.ra_records;
create policy ra_records_member on public.ra_records for all to authenticated
  using (public.ra_is_member()) with check (public.ra_is_member());

drop policy if exists ra_members_read on public.ra_members;
create policy ra_members_read on public.ra_members for select to authenticated
  using (public.ra_is_member() or email = lower(auth.jwt() ->> 'email'));
drop policy if exists ra_members_add on public.ra_members;
create policy ra_members_add on public.ra_members for insert to authenticated
  with check (public.ra_is_member() and email = lower(email));
drop policy if exists ra_members_remove on public.ra_members;
create policy ra_members_remove on public.ra_members for delete to authenticated
  using (public.ra_is_member() and email <> lower(auth.jwt() ->> 'email'));

revoke all on public.ra_records, public.ra_members from anon;
grant select, insert, update, delete on public.ra_records to authenticated;
grant select, insert, delete on public.ra_members to authenticated;

-- 4) リアルタイム同期を有効化
do $$ begin
  alter publication supabase_realtime add table public.ra_records;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- 5) 最初の管理者を登録（★書き換えてください。小文字で）
insert into public.ra_members (email, name) values ('your-email@example.com', '管理者')
on conflict (email) do nothing;
