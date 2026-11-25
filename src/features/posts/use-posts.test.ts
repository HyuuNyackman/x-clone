import { flattenTimeline } from '@/features/posts/use-posts';
import type { Post, TimelinePage } from '@/features/posts/posts-api';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const post = (id: string): Post => ({
  id,
  authorId: 'u1',
  body: id,
  createdAt: '2026-11-24T00:00:00Z',
  replyCount: 0,
  author: { handle: 'a', displayName: 'A' },
});
const page = (...ids: string[]): TimelinePage => ({ posts: ids.map(post), nextCursor: null });

describe('flattenTimeline', () => {
  it('データが無ければ空配列', () => {
    expect(flattenTimeline(undefined)).toEqual([]);
  });

  it('ページをつなげ、同じ id は 1 回だけ出す', () => {
    const data = { pages: [page('a', 'b'), page('b', 'c')], pageParams: [null, null] };
    expect(flattenTimeline(data).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});
