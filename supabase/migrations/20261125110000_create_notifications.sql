-- notifications テーブル・RLS・通知を作るトリガー (XCL-60)。
-- Data API の自動許可が OFF なので、GRANT・RLS 有効化・ポリシーを1セットで書く。

-- user_id が通知の受け取り手、actor_id が操作した人。
-- post_id は、いいね = いいねされた投稿、リプライ = 作られたリプライ、フォロー = null。
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (type in ('like', 'reply', 'follow')),
  constraint notifications_post_required check ((type = 'follow') = (post_id is null)),
  constraint notifications_no_self check (user_id <> actor_id)
);

-- 通知一覧 (新しい順) 用。
create index notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc, id desc);
-- 投稿の連鎖削除用。
create index notifications_post_id_idx on public.notifications (post_id) where post_id is not null;

-- GRANT: insert / delete は付けない (作成はトリガーだけ)。
-- update は既読化に必要な read_at の列だけにする (type や actor_id を書き換えさせない)。
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- いいね: 投稿の作者に通知する。自分の投稿へのいいねは通知しない。
-- authenticated には notifications の insert 権限が無いので security definer で動かす。
create function public.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, actor_id, post_id)
    select p.author_id, 'like', new.user_id, new.post_id
    from public.posts p
    where p.id = new.post_id and p.author_id <> new.user_id;
    return new;
  else
    -- いいねを取り消したら通知も消す (付け外しで通知が積み上がるのを防ぐ)。
    delete from public.notifications
    where type = 'like' and actor_id = old.user_id and post_id = old.post_id;
    return old;
  end if;
end;
$$;

-- リプライ: 返信先の投稿の作者に通知する。自分へのリプライは通知しない。
-- リプライを消したときは post_id の on delete cascade で通知も消える。
create function public.notify_on_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reply_to is not null then
    insert into public.notifications (user_id, type, actor_id, post_id)
    select p.author_id, 'reply', new.author_id, new.id
    from public.posts p
    where p.id = new.reply_to and p.author_id <> new.author_id;
  end if;
  return new;
end;
$$;

-- フォロー: フォローされた人に通知する (自己フォローは follows の check 制約で禁止済み)。
create function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, actor_id)
    values (new.followee_id, 'follow', new.follower_id);
    return new;
  else
    delete from public.notifications
    where type = 'follow' and actor_id = old.follower_id and user_id = old.followee_id;
    return old;
  end if;
end;
$$;

revoke execute on function public.notify_on_like() from public, anon, authenticated;
revoke execute on function public.notify_on_reply() from public, anon, authenticated;
revoke execute on function public.notify_on_follow() from public, anon, authenticated;

create trigger on_like_notify
  after insert or delete on public.likes
  for each row execute function public.notify_on_like();

create trigger on_reply_notify
  after insert on public.posts
  for each row execute function public.notify_on_reply();

create trigger on_follow_notify
  after insert or delete on public.follows
  for each row execute function public.notify_on_follow();
