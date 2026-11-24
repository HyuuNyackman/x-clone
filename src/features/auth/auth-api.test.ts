import { signIn, signOut, signUp, toAuthMessage } from '@/features/auth/auth-api';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

const auth = jest.mocked(supabase.auth);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('toAuthMessage', () => {
  it.each([
    ['invalid_credentials', 'メールアドレスまたはパスワードが正しくありません'],
    [
      'email_not_confirmed',
      'メールアドレスの確認が済んでいません。届いたメールのリンクを開いてください',
    ],
    ['user_already_exists', 'このメールアドレスは既に登録されています'],
    ['email_exists', 'このメールアドレスは既に登録されています'],
    ['weak_password', 'パスワードが弱すぎます。別のパスワードにしてください'],
    ['over_request_rate_limit', '試行が多すぎます。しばらくしてからやり直してください'],
    ['over_email_send_rate_limit', '試行が多すぎます。しばらくしてからやり直してください'],
  ])('%s を日本語にする', (code, message) => {
    expect(toAuthMessage({ code, message: 'raw' })).toBe(message);
  });

  it('未知のコードは、元のメッセージを添えて返す', () => {
    expect(toAuthMessage({ code: 'something_new', message: 'boom' })).toBe(
      'エラーが発生しました: boom',
    );
  });

  it('コードがなくても、元のメッセージを添えて返す', () => {
    expect(toAuthMessage({ message: 'boom' })).toBe('エラーが発生しました: boom');
  });
});

describe('signIn', () => {
  it('メールアドレスとパスワードで、Supabase にログインを依頼する', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: null } as never);
    await signIn({ email: 'user@example.com', password: 'pw' });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'pw',
    });
  });

  it('認証エラーは、日本語のメッセージの Error になる', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    } as never);
    await expect(signIn({ email: 'a@example.com', password: 'x' })).rejects.toThrow(
      'メールアドレスまたはパスワードが正しくありません',
    );
  });
});

describe('signUp', () => {
  it('セッションが返れば、確認待ちではない', async () => {
    auth.signUp.mockResolvedValue({
      data: { session: { access_token: 't' } },
      error: null,
    } as never);
    await expect(
      signUp({ email: 'a@example.com', password: 'password-123', confirmPassword: 'password-123' }),
    ).resolves.toEqual({ needsConfirmation: false });
  });

  it('セッションが null なら、メール確認待ちとして扱う', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null } as never);
    await expect(
      signUp({ email: 'a@example.com', password: 'password-123', confirmPassword: 'password-123' }),
    ).resolves.toEqual({ needsConfirmation: true });
  });

  it('確認用パスワードは、Supabase に渡さない', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null } as never);
    await signUp({
      email: 'a@example.com',
      password: 'password-123',
      confirmPassword: 'password-123',
    });
    expect(auth.signUp).toHaveBeenCalledWith({ email: 'a@example.com', password: 'password-123' });
  });

  it('登録済みのメールアドレスは、日本語のメッセージの Error になる', async () => {
    auth.signUp.mockResolvedValue({
      data: {},
      error: { code: 'user_already_exists', message: 'User already registered' },
    } as never);
    await expect(
      signUp({ email: 'a@example.com', password: 'password-123', confirmPassword: 'password-123' }),
    ).rejects.toThrow('このメールアドレスは既に登録されています');
  });
});

describe('signOut', () => {
  it('成功すれば、何も返さない', async () => {
    auth.signOut.mockResolvedValue({ error: null } as never);
    await expect(signOut()).resolves.toBeUndefined();
  });

  it('失敗すれば、Error になる', async () => {
    auth.signOut.mockResolvedValue({ error: { message: 'network' } } as never);
    await expect(signOut()).rejects.toThrow('エラーが発生しました: network');
  });
});
