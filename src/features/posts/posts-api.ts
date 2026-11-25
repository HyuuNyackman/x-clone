import { supabase } from '@/lib/supabase';

export type Post = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  replyCount: number;
  likeCount: number;
  likedByMe: boolean;
  author: { handle: string; displayName: string };
};

type PostRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  reply_count: number;
  like_count: number;
  // 自分の行だけを埋め込む (likes(user_id) を user_id で絞る)。無ければ空配列。
  likes?: { user_id: string }[] | null;
  profiles: { handle: string; display_name: string } | null;
};

const COLUMNS =
  'id, author_id, body, created_at, reply_count, like_count, likes(user_id), profiles!posts_author_id_fkey(handle, display_name)';

// ログインしていないとき、likes の埋め込みを 0 件にするためのダミー (どの user_id にも一致しない)。
const NO_USER = '00000000-0000-0000-0000-000000000000';

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
  like_count: number;
  liked_by_me: boolean;
};

function toPost(row: PostRow): Post {
  return {
    id: row.id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    replyCount: row.reply_count,
    likeCount: row.like_count,
    likedByMe: (row.likes?.length ?? 0) > 0,
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
  followingOnly = false,
): Promise<TimelinePage> {
  const { data, error } = await supabase.rpc('get_timeline', {
    p_before_created_at: cursor?.createdAt,
    p_before_id: cursor?.id,
    p_limit: limit,
    p_following_only: followingOnly,
  });
  if (error) throw new Error(`タイムラインを読み込めませんでした: ${error.message}`);
  const rows = (data ?? []) as unknown as TimelineRow[];
  const posts = rows.map((row): Post => ({
    id: row.id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    replyCount: row.reply_count,
    likeCount: row.like_count,
    likedByMe: row.liked_by_me,
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
export async function fetchPost(postId: string, userId?: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(COLUMNS)
    .eq('id', postId)
    .eq('likes.user_id', userId ?? NO_USER)
    .maybeSingle();
  if (error) throw new Error(`投稿を読み込めませんでした: ${error.message}`);
  return data ? toPost(data as unknown as PostRow) : null;
}

// 投稿へのリプライを、古い順に読む。
export async function fetchReplies(postId: string, userId?: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(COLUMNS)
    .eq('reply_to', postId)
    .eq('likes.user_id', userId ?? NO_USER)
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

// いいねする。複合主キー (user_id, post_id) の重複 (23505) は、すでにいいね済みなので成功として扱う。
export async function likePost(userId: string, postId: string): Promise<void> {
  const { error } = await supabase.from('likes').insert({ user_id: userId, post_id: postId });
  if (error && error.code !== '23505') {
    throw new Error(`いいねできませんでした: ${error.message}`);
  }
}

// いいねを取り消す。無い行の delete は 0 件で成功するので、二重に取り消しても安全。
export async function unlikePost(userId: string, postId: string): Promise<void> {
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId);
  if (error) throw new Error(`いいねを取り消せませんでした: ${error.message}`);
}

// 自分がフォローしている人の id 一覧。
export async function fetchFollowingIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', userId);
  if (error) throw new Error(`フォロー中の一覧を読み込めませんでした: ${error.message}`);
  return (data ?? []).map((row) => row.followee_id as string);
}

// フォローする。複合主キーの重複 (23505) は、すでにフォロー済みなので成功として扱う。
export async function followUser(userId: string, targetId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: userId, followee_id: targetId });
  if (error && error.code !== '23505') {
    throw new Error(`フォローできませんでした: ${error.message}`);
  }
}

// フォローを解除する。無い行の delete は 0 件で成功するので、二重に解除しても安全。
export async function unfollowUser(userId: string, targetId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', userId)
    .eq('followee_id', targetId);
  if (error) throw new Error(`フォローを解除できませんでした: ${error.message}`);
}

// プロフィールに出す投稿の取得件数。ページ送りは未対応 (技術負債として別 Issue)。
export const USER_POSTS_LIMIT = 50;

// ある人の投稿 (リプライを除く) を新しい順に読む。
export async function fetchUserPosts(authorId: string, userId?: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(COLUMNS)
    .eq('author_id', authorId)
    .is('reply_to', null)
    .is('repost_of', null)
    .eq('likes.user_id', userId ?? NO_USER)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(USER_POSTS_LIMIT);
  if (error) throw new Error(`投稿を読み込めませんでした: ${error.message}`);
  return ((data ?? []) as unknown as PostRow[]).map(toPost);
}
