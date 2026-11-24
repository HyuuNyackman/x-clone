import { POST_MAX_LENGTH, postSchema } from '@/features/posts/schemas';

describe('postSchema', () => {
  it('1〜280文字の本文を受け付ける', () => {
    expect(postSchema.safeParse({ body: 'こんにちは' }).success).toBe(true);
    expect(postSchema.safeParse({ body: 'a'.repeat(POST_MAX_LENGTH) }).success).toBe(true);
  });

  it('空・空白だけの本文は拒否する', () => {
    expect(postSchema.safeParse({ body: '' }).success).toBe(false);
    expect(postSchema.safeParse({ body: '   ' }).success).toBe(false);
  });

  it('281文字以上は拒否する', () => {
    expect(postSchema.safeParse({ body: 'a'.repeat(POST_MAX_LENGTH + 1) }).success).toBe(false);
  });
});
