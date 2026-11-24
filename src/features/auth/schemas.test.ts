import { loginSchema, signupSchema } from '@/features/auth/schemas';

const validSignup = {
  email: 'user@example.com',
  password: 'password-123',
  confirmPassword: 'password-123',
};

function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe('loginSchema', () => {
  it('メールアドレスとパスワードがあれば通る', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: 'x' }).success).toBe(true);
  });

  it('メールアドレスの前後の空白は取り除かれる', () => {
    const result = loginSchema.safeParse({ email: '  user@example.com  ', password: 'x' });
    expect(result.success && result.data.email).toBe('user@example.com');
  });

  it('メールアドレスが空だと、入力を促す', () => {
    const result = loginSchema.safeParse({ email: '', password: 'x' });
    expect(firstMessage(result)).toBe('メールアドレスを入力してください');
  });

  it('メールアドレスの形式が違うと、形式を知らせる', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'x' });
    expect(firstMessage(result)).toBe('メールアドレスの形式が正しくありません');
  });

  it('パスワードが空だと、入力を促す', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' });
    expect(firstMessage(result)).toBe('パスワードを入力してください');
  });
});

describe('signupSchema', () => {
  it('正しい入力は通る', () => {
    expect(signupSchema.safeParse(validSignup).success).toBe(true);
  });

  it('パスワードが 8 文字未満だと、拒否される', () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      password: 'short',
      confirmPassword: 'short',
    });
    expect(firstMessage(result)).toBe('パスワードは8文字以上にしてください');
  });

  it('パスワードが 8 文字ちょうどなら、通る', () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      password: '12345678',
      confirmPassword: '12345678',
    });
    expect(result.success).toBe(true);
  });

  it('パスワードが 72 文字を超えると、拒否される', () => {
    const long = 'a'.repeat(73);
    const result = signupSchema.safeParse({
      ...validSignup,
      password: long,
      confirmPassword: long,
    });
    expect(firstMessage(result)).toBe('パスワードは72文字以内にしてください');
  });

  it('確認用パスワードが違うと、確認用の欄にエラーが付く', () => {
    const result = signupSchema.safeParse({ ...validSignup, confirmPassword: 'different-123' });
    const issue = result.error?.issues.find((i) => i.message === 'パスワードが一致しません');
    expect(issue?.path).toEqual(['confirmPassword']);
  });
});
