import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import LoginScreen from '@/app/(auth)/login';
import SignupScreen from '@/app/(auth)/signup';
import { signIn, signUp } from '@/features/auth/auth-api';

// 実際に Supabase へ繋がないよう、認証 API を差し替える。
jest.mock('@/features/auth/auth-api', () => ({
  signIn: jest.fn(),
  signUp: jest.fn(),
}));

const mockedSignIn = jest.mocked(signIn);
const mockedSignUp = jest.mocked(signUp);

const routes = { login: LoginScreen, signup: SignupScreen };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ログイン画面', () => {
  it('空のまま送信すると、入力を促し、ログインは呼ばれない', async () => {
    await renderRouter(routes, { initialUrl: '/login' });
    await fireEvent.press(screen.getByRole('button', { name: 'ログイン' }));

    expect(await screen.findByText('メールアドレスを入力してください')).toBeOnTheScreen();
    expect(screen.getByText('パスワードを入力してください')).toBeOnTheScreen();
    expect(mockedSignIn).not.toHaveBeenCalled();
  });

  it('入力して送信すると、その値でログインが呼ばれる', async () => {
    mockedSignIn.mockResolvedValue(undefined);
    await renderRouter(routes, { initialUrl: '/login' });

    await fireEvent.changeText(screen.getByLabelText('メールアドレス'), 'user@example.com');
    await fireEvent.changeText(screen.getByLabelText('パスワード'), 'password-123');
    await fireEvent.press(screen.getByRole('button', { name: 'ログイン' }));

    await waitFor(() =>
      expect(mockedSignIn).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password-123',
      }),
    );
  });

  it('ログインに失敗すると、そのメッセージを表示する', async () => {
    mockedSignIn.mockRejectedValue(new Error('メールアドレスまたはパスワードが正しくありません'));
    await renderRouter(routes, { initialUrl: '/login' });

    await fireEvent.changeText(screen.getByLabelText('メールアドレス'), 'user@example.com');
    await fireEvent.changeText(screen.getByLabelText('パスワード'), 'wrong-password');
    await fireEvent.press(screen.getByRole('button', { name: 'ログイン' }));

    expect(
      await screen.findByText('メールアドレスまたはパスワードが正しくありません'),
    ).toBeOnTheScreen();
  });

  it('「アカウントを作成する」で、サインアップ画面へ移る', async () => {
    await renderRouter(routes, { initialUrl: '/login' });
    await fireEvent.press(screen.getByText('アカウントを作成する'));
    await waitFor(() => expect(screen).toHavePathname('/signup'));
  });
});

describe('サインアップ画面', () => {
  async function fill(password: string, confirm: string) {
    await fireEvent.changeText(screen.getByLabelText('メールアドレス'), 'user@example.com');
    await fireEvent.changeText(screen.getByLabelText('パスワード (8文字以上)'), password);
    await fireEvent.changeText(screen.getByLabelText('パスワード (確認)'), confirm);
    await fireEvent.press(screen.getByRole('button', { name: '登録する' }));
  }

  it('パスワードが一致しないと、エラーを表示し、登録は呼ばれない', async () => {
    await renderRouter(routes, { initialUrl: '/signup' });
    await fill('password-123', 'different-123');

    expect(await screen.findByText('パスワードが一致しません')).toBeOnTheScreen();
    expect(mockedSignUp).not.toHaveBeenCalled();
  });

  it('8 文字未満のパスワードは、拒否される', async () => {
    await renderRouter(routes, { initialUrl: '/signup' });
    await fill('short', 'short');

    expect(await screen.findByText('パスワードは8文字以上にしてください')).toBeOnTheScreen();
    expect(mockedSignUp).not.toHaveBeenCalled();
  });

  it('メール確認が要るときは、確認待ちの案内を出す', async () => {
    mockedSignUp.mockResolvedValue({ needsConfirmation: true });
    await renderRouter(routes, { initialUrl: '/signup' });
    await fill('password-123', 'password-123');

    expect(
      await screen.findByText(
        '確認メールを送りました。メール内のリンクを開いてから、ログインしてください。',
      ),
    ).toBeOnTheScreen();
  });

  it('登録に失敗すると、そのメッセージを表示する', async () => {
    mockedSignUp.mockRejectedValue(new Error('このメールアドレスは既に登録されています'));
    await renderRouter(routes, { initialUrl: '/signup' });
    await fill('password-123', 'password-123');

    expect(await screen.findByText('このメールアドレスは既に登録されています')).toBeOnTheScreen();
  });
});
