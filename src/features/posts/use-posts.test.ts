import { applyFollow, applyLike, flattenTimeline } from '@/features/posts/use-posts';
import type { Post, TimelinePage } from '@/features/posts/posts-api';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const post = (id: string): Post => ({
  id,
  authorId: 'u1',
  body: id,
  createdAt: '2026-11-24T00:00:00Z',
  replyCount: 0,
  likeCount: 0,
  likedByMe: false,
  author: { handle: 'a', displayName: 'A' },
  media: [],
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

describe('applyLike', () => {
  it('いいねすると、済みになって数が +1', () => {
    expect(applyLike(post('a'), true)).toMatchObject({ likedByMe: true, likeCount: 1 });
  });

  it('取り消すと、数が -1 (0 未満にはしない)', () => {
    const liked = { ...post('a'), likedByMe: true, likeCount: 2 };
    expect(applyLike(liked, false)).toMatchObject({ likedByMe: false, likeCount: 1 });
    expect(applyLike({ ...liked, likeCount: 0 }, false).likeCount).toBe(0);
  });

  it('すでに同じ状態なら、数を二重に増やさない', () => {
    const liked = { ...post('a'), likedByMe: true, likeCount: 1 };
    expect(applyLike(liked, true)).toBe(liked);
  });
});

describe('applyFollow', () => {
  it('フォローすると id が増える (重複なし)', () => {
    expect(applyFollow(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(applyFollow(['a', 'b'], 'b', true)).toEqual(['a', 'b']);
  });

  it('解除すると id が外れる。無い id の解除は何も変えない', () => {
    expect(applyFollow(['a', 'b'], 'b', false)).toEqual(['a']);
    expect(applyFollow(['a'], 'z', false)).toEqual(['a']);
  });
});
