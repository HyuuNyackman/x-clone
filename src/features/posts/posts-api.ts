import { supabase } from '@/lib/supabase';

export type Post = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  replyCount: number;
  author: { handle: string; displayName: string };
};

type PostRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  reply_count: number;
  profiles: { handle: string; display_name: string } | null;
};

const COLUMNS =
  'id, author_id, body, created_at, reply_count, profiles!posts_author_id_fkey(handle, display_name)';

// 1 ページの件数。
export const TIMELINE_PAGE_SIZE = 20;

// 続きを読む位置。直前のページの最後の投稿の (createdAt, id)。
export type TimelineCursor = { createdAt: string; id: string };

export type TimelinePage = { posts: Post[]; nextCursor: TimelineCursor | null };

type TimelineRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  handle: string;
  display_name: string;
  reply_count: number;
};

function toPost(row: PostRow): Post {
  return {
    id: row.id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    replyCount: row.reply_count,
    author: {
      handle: row.profiles?.handle ?? '',
      displayName: row.profiles?.display_name ?? '',
    },
  };
}

// タイムライン取得 RPC (get_timeline) で 1 ページ読む。(created_at, id) のカーソルなので、重複も欠落も出ない。
export async function fetchTimelinePage(
  cursor: TimelineCursor | null,
  limit = TIMELINE_PAGE_SIZE,
): Promise<TimelinePage> {
  const { data, error } = await supabase.rpc('get_timeline', {
    p_before_created_at: cursor?.createdAt,
    p_before_id: cursor?.id,
    p_limit: limit,
  });
  if (error) throw new Error(`タイムラインを読み込めませんでした: ${error.message}`);
  const rows = (data ?? []) as unknown as TimelineRow[];
  const posts = rows.map((row): Post => ({
    id: row.id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    replyCount: row.reply_count,
    author: { handle: row.handle, displayName: row.display_name },
  }));
  const last = posts[posts.length - 1];
  return {
    posts,
    // 件数が満たないなら、もう続きはない。
    nextCursor: last && posts.length >= limit ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

// リプライ一覧の 1 回の取得件数。ページ送りは未対応 (技術負債として別 Issue)。
export const REPLIES_LIMIT = 100;

// 投稿 1 件を読む。消えている (または見えない) ときは null。
export async function fetchPost(postId: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(COLUMNS)
    .eq('id', postId)
    .maybeSingle();
  if (error) throw new Error(`投稿を読み込めませんでした: ${error.message}`);
  return data ? toPost(data as unknown as PostRow) : null;
}

// 投稿へのリプライを、古い順に読む。
export async function fetchReplies(postId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(COLUMNS)
    .eq('reply_to', postId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(REPLIES_LIMIT);
  if (error) throw new Error(`リプライを読み込めませんでした: ${error.message}`);
  return ((data ?? []) as unknown as PostRow[]).map(toPost);
}

export async function createPost(authorId: string, body: string, replyTo?: string): Promise<Post> {
  const { data, error } = await supabase
    .from('posts')
    .insert({ author_id: authorId, body, ...(replyTo ? { reply_to: replyTo } : {}) })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`投稿できませんでした: ${error.message}`);
  return toPost(data as unknown as PostRow);
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw new Error(`投稿を削除できませんでした: ${error.message}`);
}
