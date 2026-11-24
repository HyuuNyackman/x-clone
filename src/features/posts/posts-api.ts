import { supabase } from '@/lib/supabase';

export type Post = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: { handle: string; displayName: string };
};

type PostRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles: { handle: string; display_name: string } | null;
};

const COLUMNS =
  'id, author_id, body, created_at, profiles!posts_author_id_fkey(handle, display_name)';

// タイムラインに出す件数。ページネーションは別の Issue (XCL: タイムライン取得 RPC) で行う。
export const TIMELINE_LIMIT = 50;

function toPost(row: PostRow): Post {
  return {
    id: row.id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    author: {
      handle: row.profiles?.handle ?? '',
      displayName: row.profiles?.display_name ?? '',
    },
  };
}

// 通常の投稿だけを新しい順に読む (リポストは本文が空なので除く)。
export async function fetchTimeline(): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(COLUMNS)
    .is('repost_of', null)
    .order('created_at', { ascending: false })
    .limit(TIMELINE_LIMIT);
  if (error) throw new Error(`タイムラインを読み込めませんでした: ${error.message}`);
  return (data as unknown as PostRow[]).map(toPost);
}

export async function createPost(authorId: string, body: string): Promise<Post> {
  const { data, error } = await supabase
    .from('posts')
    .insert({ author_id: authorId, body })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`投稿できませんでした: ${error.message}`);
  return toPost(data as unknown as PostRow);
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw new Error(`投稿を削除できませんでした: ${error.message}`);
}
