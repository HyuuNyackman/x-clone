import { removeImages, uploadImage } from '@/features/media/media-api';
import type { ProcessedImage } from '@/features/media/image-processing';
import { supabase } from '@/lib/supabase';

export type PostMedia = { storageKey: string; width: number; height: number };

// 1 投稿に付けられる画像の上限 (post_media_sort_order_range と揃える)。
export const MAX_POST_IMAGES = 4;

export type Post = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  replyCount: number;
  likeCount: number;
  likedByMe: boolean;
  author: { handle: string; displayName: string };
  // 表示順。画像がなければ空配列。
  media: PostMedia[];
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
  post_media?: MediaRow[] | null;
};

type MediaRow = { storage_key: string; width: number; height: number; sort_order: number };

function toMedia(rows: MediaRow[] | null | undefined): PostMedia[] {
  return [...(rows ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => ({ storageKey: m.storage_key, width: m.width, height: m.height }));
}

const COLUMNS =
  'id, author_id, body, created_at, reply_count, like_count, likes(user_id), profiles!posts_author_id_fkey(handle, display_name), post_media(storage_key, width, height, sort_order)';

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
    media: toMedia(row.post_media),
  };
}

// RPC の結果には画像が含まれないので、post_media をまとめて 1 回で読んで付ける。
export async function attachMedia(posts: Post[]): Promise<void> {
  if (posts.length === 0) return;
  const { data, error } = await supabase
    .from('post_media')
    .select('post_id, storage_key, width, height, sort_order')
    .in(
      'post_id',
      posts.map((p) => p.id),
    );
  if (error) throw new Error(`画像を読み込めませんでした: ${error.message}`);
  const byPost = new Map<string, MediaRow[]>();
  for (const row of (data ?? []) as (MediaRow & { post_id: string })[]) {
    byPost.set(row.post_id, [...(byPost.get(row.post_id) ?? []), row]);
  }
  for (const post of posts) post.media = toMedia(byPost.get(post.id));
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
    media: [],
  }));
  await attachMedia(posts);
  return toPage(posts, limit);
}

// リプライ一覧・プロフィールの投稿タブの 1 ページの件数。
export const REPLIES_PAGE_SIZE = 20;
export const USER_POSTS_PAGE_SIZE = 20;

// (created_at, id) のカーソルより後ろだけに絞る条件 (PostgREST の or)。値は引用符で囲む。
function afterCursor(cursor: TimelineCursor, direction: 'asc' | 'desc'): string {
  const op = direction === 'asc' ? 'gt' : 'lt';
  const at = `"${cursor.createdAt}"`;
  return `created_at.${op}.${at},and(created_at.eq.${at},id.${op}.${cursor.id})`;
}

function toPage(posts: Post[], limit: number): TimelinePage {
  const last = posts[posts.length - 1];
  return {
    posts,
    // 件数が満たないなら、もう続きはない。
    nextCursor: last && posts.length >= limit ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

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

// 投稿へのリプライを、古い順に 1 ページ読む。(created_at, id) のカーソルなので、重複も欠落も出ない。
export async function fetchRepliesPage(
  postId: string,
  cursor: TimelineCursor | null,
  userId?: string,
  limit = REPLIES_PAGE_SIZE,
): Promise<TimelinePage> {
  let query = supabase
    .from('posts')
    .select(COLUMNS)
    .eq('reply_to', postId)
    .eq('likes.user_id', userId ?? NO_USER);
  if (cursor) query = query.or(afterCursor(cursor, 'asc'));
  const { data, error } = await query
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`リプライを読み込めませんでした: ${error.message}`);
  return toPage(((data ?? []) as unknown as PostRow[]).map(toPost), limit);
}

// 投稿を作る。画像があれば、自分のフォルダへアップロードして post_media に紐付ける。
// 途中で失敗したら、作った投稿とアップロード済みの画像を片付ける。
export async function createPost(
  authorId: string,
  body: string,
  replyTo?: string,
  images: ProcessedImage[] = [],
): Promise<Post> {
  const keys: string[] = [];
  try {
    for (const image of images) keys.push(await uploadImage('post-media', authorId, image));
  } catch (e) {
    await removeImages('post-media', keys);
    throw e;
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({ author_id: authorId, body, ...(replyTo ? { reply_to: replyTo } : {}) })
    .select(COLUMNS)
    .single();
  if (error) {
    await removeImages('post-media', keys);
    throw new Error(`投稿できませんでした: ${error.message}`);
  }
  const post = toPost(data as unknown as PostRow);
  if (images.length === 0) return post;

  const rows = images.map((image, i) => ({
    post_id: post.id,
    storage_key: keys[i],
    width: image.width,
    height: image.height,
    sort_order: i,
  }));
  const { error: mediaError } = await supabase.from('post_media').insert(rows);
  if (mediaError) {
    await supabase.from('posts').delete().eq('id', post.id);
    await removeImages('post-media', keys);
    throw new Error(`画像を保存できませんでした: ${mediaError.message}`);
  }
  return {
    ...post,
    media: images.map((image, i) => ({
      storageKey: keys[i],
      width: image.width,
      height: image.height,
    })),
  };
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

// 自分がフォローしている人の id のうち、authorIds に含まれるもの。
// 表示中の投稿の投稿者だけを in で引くので、フォロー数が多くても件数は画面の分に収まる。
export async function fetchFollowingIds(userId: string, authorIds: string[]): Promise<string[]> {
  if (authorIds.length === 0) return [];
  const { data, error } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', userId)
    .in('followee_id', authorIds);
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

// ある人の投稿 (リプライを除く) を新しい順に 1 ページ読む。
export async function fetchUserPostsPage(
  authorId: string,
  cursor: TimelineCursor | null,
  userId?: string,
  limit = USER_POSTS_PAGE_SIZE,
): Promise<TimelinePage> {
  let query = supabase
    .from('posts')
    .select(COLUMNS)
    .eq('author_id', authorId)
    .is('reply_to', null)
    .is('repost_of', null)
    .eq('likes.user_id', userId ?? NO_USER);
  if (cursor) query = query.or(afterCursor(cursor, 'desc'));
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`投稿を読み込めませんでした: ${error.message}`);
  return toPage(((data ?? []) as unknown as PostRow[]).map(toPost), limit);
}

// ブックマーク一覧の取得件数。ページ送りは未対応 (技術負債として別 Issue)。
export const BOOKMARKS_LIMIT = 50;

// 自分がブックマークした投稿の id 一覧。
export async function fetchBookmarkedIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('bookmarks').select('post_id').eq('user_id', userId);
  if (error) throw new Error(`ブックマークを読み込めませんでした: ${error.message}`);
  return (data ?? []).map((row) => row.post_id as string);
}

// ブックマークする。複合主キーの重複 (23505) は、すでにブックマーク済みなので成功として扱う。
export async function addBookmark(userId: string, postId: string): Promise<void> {
  const { error } = await supabase.from('bookmarks').insert({ user_id: userId, post_id: postId });
  if (error && error.code !== '23505') {
    throw new Error(`ブックマークできませんでした: ${error.message}`);
  }
}

// ブックマークを解除する。無い行の delete は 0 件で成功するので、二重に解除しても安全。
export async function removeBookmark(userId: string, postId: string): Promise<void> {
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId);
  if (error) throw new Error(`ブックマークを解除できませんでした: ${error.message}`);
}

// 自分のブックマークした投稿を、ブックマークした新しい順に読む。
// RLS で自分の行しか見えないが、user_id でも絞る。
export async function fetchBookmarkedPosts(userId: string): Promise<Post[]> {
  const { data: marks, error: markError } = await supabase
    .from('bookmarks')
    .select('post_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('post_id', { ascending: false })
    .limit(BOOKMARKS_LIMIT);
  if (markError) throw new Error(`ブックマークを読み込めませんでした: ${markError.message}`);
  const ids = (marks ?? []).map((row) => row.post_id as string);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('posts')
    .select(COLUMNS)
    .in('id', ids)
    .eq('likes.user_id', userId);
  if (error) throw new Error(`投稿を読み込めませんでした: ${error.message}`);
  const byId = new Map(((data ?? []) as unknown as PostRow[]).map((row) => [row.id, toPost(row)]));
  // 投稿が消えている (連鎖削除の途中など) 分は飛ばし、ブックマークした順に並べ直す。
  return ids.flatMap((id) => byId.get(id) ?? []);
}
