import { supabase } from '@/lib/supabase';

export type NotificationType = 'like' | 'reply' | 'follow';

export type AppNotification = {
  id: string;
  type: NotificationType;
  actor: { handle: string; displayName: string; avatarUrl: string | null };
  postId: string | null;
  // いいね = いいねされた投稿の本文、リプライ = リプライの本文。フォローは null。
  postBody: string | null;
  read: boolean;
  createdAt: string;
};

type NotificationRow = {
  id: string;
  type: NotificationType;
  post_id: string | null;
  read_at: string | null;
  created_at: string;
  profiles: { handle: string; display_name: string; avatar_url: string | null } | null;
  posts: { body: string } | null;
};

const COLUMNS =
  'id, type, post_id, read_at, created_at, profiles!notifications_actor_id_fkey(handle, display_name, avatar_url), posts(body)';

// 一覧の最大件数。ページネーションは未対応 (最新の件数だけ出す)。
export const NOTIFICATIONS_LIMIT = 50;

export function toNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type,
    actor: {
      handle: row.profiles?.handle ?? '',
      displayName: row.profiles?.display_name ?? '',
      avatarUrl: row.profiles?.avatar_url ?? null,
    },
    postId: row.post_id,
    postBody: row.posts?.body ?? null,
    read: row.read_at !== null,
    createdAt: row.created_at,
  };
}

// 自分宛ての通知 (新しい順)。RLS で本人の行だけが返る。
export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(NOTIFICATIONS_LIMIT);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as NotificationRow[]).map(toNotification);
}

export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// 1 件を既読にする。すでに既読の行は変えない。
export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
  if (error) throw new Error(error.message);
}

// 未読をすべて既読にする。
export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw new Error(error.message);
}
