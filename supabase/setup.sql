-- =====================================================================
-- 選考進捗ボード：Supabase の初期設定（SQL Editor に全部貼り付けて Run）
--
-- ★ 書き換えるのは下の「★ここを書き換え★」の1行だけです
--    最初の管理者（あなた）のメールアドレスにしてください。Googleログインに使う Gmail など
--    書き換えずに実行すると、エラーで止まり何も変更されません
--
-- ・全体が1回の処理として実行され、途中でエラーになった場合は何も変更されません
-- ・何度実行しても大丈夫です（既存のデータは消えません）
-- ・「destructive operation」の確認が出たら、そのまま実行して問題ありません
--   （drop policy / drop trigger は、設定を作り直すためのもので、データは消しません）
-- =====================================================================

create temp table if not exists ra_setup (admin_email text);
truncate ra_setup;
insert into ra_setup values ('your-email@example.com');   -- ★ここを書き換え★

do $$
declare e text := (select lower(trim(admin_email)) from ra_setup);
begin
  if e is null or e = 'your-email@example.com' or e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception '★ 管理者のメールアドレスを書き換えてから実行してください（何も変更されていません）';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 1) 許可メンバー
--    role = 'admin'（メンバーの追加・削除ができる）／ 'member'（データの閲覧・編集のみ）
-- ---------------------------------------------------------------------
create table if not exists public.ra_members (
  email      text primary key,
  name       text not null default '',
  role       text not null default 'member',
  created_at timestamptz not null default now(),
  added_by   text
);
alter table public.ra_members add column if not exists role text not null default 'member';
do $$ begin
  alter table public.ra_members add constraint ra_members_email_lower check (email = lower(email) and email like '%_@_%');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.ra_members add constraint ra_members_role_check check (role in ('admin', 'member'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2) アプリのデータ（求職者・応募・予定などをすべて JSON で保存）
-- ---------------------------------------------------------------------
create table if not exists public.ra_records (
  id         text primary key,
  kind       text not null,
  data       jsonb not null,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists ra_records_updated_at on public.ra_records (updated_at);


-- ---------------------------------------------------------------------
-- 3) 権限チェック用の関数
--    メールアドレスはログイン情報（JWT）ではなく auth.users から取り、
--    「メール確認済み」の人だけをメンバーとして扱う
-- ---------------------------------------------------------------------
create or replace function public.ra_my_role() returns text
language sql stable security definer set search_path = '' as $$
  select m.role
  from auth.users u
  join public.ra_members m on m.email = lower(u.email)
  where u.id = auth.uid() and u.email_confirmed_at is not null
  limit 1;
$$;
create or replace function public.ra_is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.ra_my_role() is not null;
$$;
create or replace function public.ra_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.ra_my_role() = 'admin', false);
$$;
create or replace function public.ra_my_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u where u.id = auth.uid();
$$;

-- 更新日時・更新者はサーバー側で記録（画面側から偽れない）
create or replace function public.ra_touch() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := public.ra_my_email();
  return new;
end $$;
drop trigger if exists ra_touch on public.ra_records;
create trigger ra_touch before insert or update on public.ra_records
  for each row execute function public.ra_touch();

-- メンバー追加時：メールを小文字にそろえ、追加した人を記録
create or replace function public.ra_members_stamp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.email := lower(trim(new.email));
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.added_by := coalesce(public.ra_my_email(), 'sql-editor');
  else
    new.created_at := old.created_at;
    new.added_by := old.added_by;
  end if;
  return new;
end $$;
drop trigger if exists ra_members_stamp on public.ra_members;
create trigger ra_members_stamp before insert or update on public.ra_members
  for each row execute function public.ra_members_stamp();

revoke all on function public.ra_my_role(), public.ra_is_member(), public.ra_is_admin(), public.ra_my_email(),
  public.ra_touch(), public.ra_members_stamp() from public, anon, authenticated;
grant execute on function public.ra_my_role(), public.ra_is_member(), public.ra_is_admin(), public.ra_my_email() to authenticated;


-- ---------------------------------------------------------------------
-- 4) アクセス制限（RLS）
--    ・ログインしていない人（anon）：何もできない
--    ・ログインしたがメンバーでない人：何も見えない・書けない
--    ・メンバー：データの閲覧・追加・編集（削除はアプリ内のゴミ箱方式）
--    ・管理者：上記＋メンバーの追加・変更・削除、データ行の物理削除
-- ---------------------------------------------------------------------
alter table public.ra_records enable row level security;
alter table public.ra_members enable row level security;

drop policy if exists ra_records_member on public.ra_records;
drop policy if exists ra_records_select on public.ra_records;
drop policy if exists ra_records_insert on public.ra_records;
drop policy if exists ra_records_update on public.ra_records;
drop policy if exists ra_records_delete on public.ra_records;
create policy ra_records_select on public.ra_records for select to authenticated using ((select public.ra_is_member()));
create policy ra_records_insert on public.ra_records for insert to authenticated with check ((select public.ra_is_member()));
create policy ra_records_update on public.ra_records for update to authenticated
  using ((select public.ra_is_member())) with check ((select public.ra_is_member()));
create policy ra_records_delete on public.ra_records for delete to authenticated using ((select public.ra_is_admin()));

drop policy if exists ra_members_read on public.ra_members;
drop policy if exists ra_members_add on public.ra_members;
drop policy if exists ra_members_change on public.ra_members;
drop policy if exists ra_members_remove on public.ra_members;
create policy ra_members_read on public.ra_members for select to authenticated using ((select public.ra_is_member()));
create policy ra_members_add on public.ra_members for insert to authenticated with check ((select public.ra_is_admin()));
-- 自分自身の権限変更・削除はできない（管理者がいなくなるのを防ぐ）
create policy ra_members_change on public.ra_members for update to authenticated
  using ((select public.ra_is_admin()) and email <> (select public.ra_my_email()))
  with check ((select public.ra_is_admin()) and email <> (select public.ra_my_email()));
create policy ra_members_remove on public.ra_members for delete to authenticated
  using ((select public.ra_is_admin()) and email <> (select public.ra_my_email()));

-- テーブルの操作権限：anon には一切与えない
revoke all on public.ra_records, public.ra_members from public, anon, authenticated;
grant select, insert, update, delete on public.ra_records to authenticated;
grant select, insert, delete on public.ra_members to authenticated;
grant update (name, role) on public.ra_members to authenticated;


-- ---------------------------------------------------------------------
-- 5) リアルタイム同期（変更通知も RLS に従い、メンバーにだけ届く）
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.ra_records;
exception when duplicate_object then null; when undefined_object then null;
end $$;


-- ---------------------------------------------------------------------
-- 6) 最初の管理者を登録（すでに登録済みなら管理者にする）
-- ---------------------------------------------------------------------
insert into public.ra_members (email, name, role)
select lower(trim(admin_email)), '管理者', 'admin' from ra_setup
on conflict (email) do update set role = 'admin';

drop table ra_setup;

-- 確認用：登録されたメンバーが表示されれば完了です
select email, name, role from public.ra_members order by created_at;
