import { profileSchema } from '@/features/profile/schemas';

const valid = { handle: 'alice_01', displayName: 'Alice', bio: '' };

describe('profileSchema', () => {
  it('正しい入力は通る', () => {
    expect(profileSchema.safeParse(valid).success).toBe(true);
  });

  it.each(['ab', 'a'.repeat(16), 'Alice', 'bad-handle', 'あいう', 'a b c'])(
    'handle %s は拒否される',
    (handle) => {
      expect(profileSchema.safeParse({ ...valid, handle }).success).toBe(false);
    },
  );

  it('handle は 3〜15 文字の境目を通す', () => {
    expect(profileSchema.safeParse({ ...valid, handle: 'abc' }).success).toBe(true);
    expect(profileSchema.safeParse({ ...valid, handle: 'a'.repeat(15) }).success).toBe(true);
  });

  it('表示名は空と、51文字以上を拒否する', () => {
    expect(profileSchema.safeParse({ ...valid, displayName: '  ' }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, displayName: 'あ'.repeat(51) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, displayName: 'あ'.repeat(50) }).success).toBe(true);
  });

  it('bio は 160 文字まで', () => {
    expect(profileSchema.safeParse({ ...valid, bio: 'a'.repeat(160) }).success).toBe(true);
    expect(profileSchema.safeParse({ ...valid, bio: 'a'.repeat(161) }).success).toBe(false);
  });
});
