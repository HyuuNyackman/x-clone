import {
  attachMedia,
  TIMELINE_PAGE_SIZE,
  type Post,
  type TimelineCursor,
  type TimelinePage,
} from '@/features/posts/posts-api';
import type { Profile } from '@/features/profile/profile-api';
import { supabase } from '@/lib/supabase';

type SearchPostRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  reply_count: number;
  like_count: number;
  liked_by_me: boolean;
};

type SearchUserRow = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
};

// 投稿の検索 (RPC search_posts)。get_timeline と同じ (created_at, id) のカーソルで続きを読む。
export async function searchPostsPage(
  query: string,
  cursor: TimelineCursor | null,
  limit = TIMELINE_PAGE_SIZE,
): Promise<TimelinePage> {
  const { data, error } = await supabase.rpc('search_posts', {
    p_query: query,
    p_before_created_at: cursor?.createdAt,
    p_before_id: cursor?.id,
    p_limit: limit,
  });
  if (error) throw new Error(`投稿を検索できませんでした: ${error.message}`);
  const posts = ((data ?? []) as unknown as SearchPostRow[]).map((row): Post => ({
    id: row.id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    replyCount: row.reply_count,
    likeCount: row.like_count,
    likedByMe: row.liked_by_me,
    author: { handle: row.handle, displayName: row.display_name, avatarUrl: row.avatar_url },
    media: [],
  }));
  await attachMedia(posts);
  const last = posts[posts.length - 1];
  return {
    posts,
    nextCursor: last && posts.length >= limit ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

// ユーザーの検索 (RPC search_users)。ページ送りはなく、上位の件数だけ返す。
export const USER_SEARCH_LIMIT = 20;

export async function searchUsers(query: string): Promise<Profile[]> {
  const { data, error } = await supabase.rpc('search_users', {
    p_query: query,
    p_limit: USER_SEARCH_LIMIT,
  });
  if (error) throw new Error(`ユーザーを検索できませんでした: ${error.message}`);
  return ((data ?? []) as unknown as SearchUserRow[]).map((row) => ({
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
  }));
}
