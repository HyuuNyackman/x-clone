import {
  applyBookmark,
  applyFollow,
  applyLike,
  authorIdsOf,
  flattenTimeline,
  removeAuthorPosts,
} from '@/features/posts/use-posts';
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
  author: { handle: 'a', displayName: 'A', avatarUrl: null },
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

describe('removeAuthorPosts / authorIdsOf', () => {
  const by = (id: string, authorId: string): Post => ({ ...post(id), authorId });

  it('指定した投稿者の投稿を全ページから外す', () => {
    const data = {
      pages: [
        { posts: [by('a', 'u1'), by('b', 'u2')], nextCursor: null },
        { posts: [by('c', 'u1')], nextCursor: null },
      ],
      pageParams: [null, null],
    };
    const result = removeAuthorPosts(data, 'u1');
    expect(result?.pages.map((p) => p.posts.map((x) => x.id))).toEqual([['b'], []]);
    expect(removeAuthorPosts(undefined, 'u1')).toBeUndefined();
  });

  it('投稿者 id を重複なしで返す', () => {
    expect(authorIdsOf([by('a', 'u1'), by('b', 'u2'), by('c', 'u1')])).toEqual(['u1', 'u2']);
  });
});

describe('applyBookmark', () => {
  it('ブックマークすると末尾に足し、二重には足さない', () => {
    expect(applyBookmark(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(applyBookmark(['a', 'b'], 'b', true)).toEqual(['a', 'b']);
  });

  it('解除すると取り除く。無い id でも壊れない', () => {
    expect(applyBookmark(['a', 'b'], 'b', false)).toEqual(['a']);
    expect(applyBookmark(['a'], 'z', false)).toEqual(['a']);
  });
});
