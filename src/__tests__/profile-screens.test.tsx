import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import ProfileScreen from '@/app/(tabs)/profile';
import ProfileSetupScreen from '@/app/profile-setup';
import { useAuthStore } from '@/features/auth/auth-store';
import { ProfileFieldError } from '@/features/profile/profile-api';
import { useProfile, useSaveProfile } from '@/features/profile/use-profile';

// Supabase にも QueryClient にも繋がないよう、フックを差し替える。
jest.mock('@/features/profile/use-profile', () => ({
  useProfile: jest.fn(),
  useSaveProfile: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/features/auth/auth-store', () => ({ useAuthStore: jest.fn() }));

const USER_ID = 'a1000000-0000-0000-0000-000000000001';
const save = jest.fn();

const profile = {
  id: USER_ID,
  handle: 'alice',
  displayName: 'Alice',
  avatarUrl: null,
  bio: 'こんにちは',
};

const routes = { 'profile-setup': ProfileSetupScreen, profile: ProfileScreen, home: () => null };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useSaveProfile).mockReturnValue(save);
  jest
    .mocked(useAuthStore)
    .mockImplementation(((selector: (s: unknown) => unknown) =>
      selector({ session: { user: { id: USER_ID } } })) as never);
  jest.mocked(useProfile).mockReturnValue({ data: profile, isError: false } as never);
});

describe('プロフィール編集画面', () => {
  it('今のプロフィールが入力欄に入っている', async () => {
    await renderRouter(routes, { initialUrl: '/profile' });
    expect(screen.getByLabelText('ハンドル').props.value).toBe('alice');
    expect(screen.getByLabelText('表示名').props.value).toBe('Alice');
    expect(screen.getByLabelText('自己紹介').props.value).toBe('こんにちは');
  });

  it('編集して保存すると、その値で保存が呼ばれ、保存済みと出る', async () => {
    save.mockResolvedValue(undefined);
    await renderRouter(routes, { initialUrl: '/profile' });

    await fireEvent.changeText(screen.getByLabelText('表示名'), 'Alice B');
    await fireEvent.changeText(screen.getByLabelText('自己紹介'), 'よろしく');
    await fireEvent.press(screen.getByRole('button', { name: '保存する' }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        handle: 'alice',
        displayName: 'Alice B',
        bio: 'よろしく',
      }),
    );
    expect(await screen.findByText('保存しました')).toBeOnTheScreen();
  });

  it('handle が重複していたら、handle 欄にエラーを出す', async () => {
    save.mockRejectedValue(new ProfileFieldError('handle', 'このハンドルは既に使われています'));
    await renderRouter(routes, { initialUrl: '/profile' });

    await fireEvent.changeText(screen.getByLabelText('ハンドル'), 'bob');
    await fireEvent.press(screen.getByRole('button', { name: '保存する' }));

    expect(await screen.findByText('このハンドルは既に使われています')).toBeOnTheScreen();
    expect(screen.queryByText('保存しました')).not.toBeOnTheScreen();
  });

  it('入力が不正なら、保存は呼ばれない', async () => {
    await renderRouter(routes, { initialUrl: '/profile' });

    await fireEvent.changeText(screen.getByLabelText('ハンドル'), 'Bad-Handle');
    await fireEvent.changeText(screen.getByLabelText('表示名'), '');
    await fireEvent.press(screen.getByRole('button', { name: '保存する' }));

    expect(await screen.findByText('表示名を入力してください')).toBeOnTheScreen();
    expect(
      screen.getByText('ハンドルは半角の小文字英数字とアンダースコアで、3〜15文字にしてください'),
    ).toBeOnTheScreen();
    expect(save).not.toHaveBeenCalled();
  });

  it('読み込みに失敗したら、そのメッセージを出す', async () => {
    jest
      .mocked(useProfile)
      .mockReturnValue({ data: undefined, isError: true, error: new Error('読めません') } as never);
    await renderRouter(routes, { initialUrl: '/profile' });
    expect(screen.getByText('読めません')).toBeOnTheScreen();
  });
});

describe('プロフィール初回設定画面', () => {
  const setupProfile = {
    ...profile,
    handle: 'user_a100000000',
    displayName: 'user_a100000000',
    bio: '',
  };

  beforeEach(() => {
    jest.mocked(useProfile).mockReturnValue({ data: setupProfile, isError: false } as never);
  });

  it('handle は空で始まる', async () => {
    await renderRouter(routes, { initialUrl: '/profile-setup' });
    expect(screen.getByLabelText('ハンドル').props.value).toBe('');
  });

  it('設定して保存すると、保存が呼ばれてホームへ移る', async () => {
    save.mockResolvedValue(undefined);
    await renderRouter(routes, { initialUrl: '/profile-setup' });

    await fireEvent.changeText(screen.getByLabelText('ハンドル'), 'alice');
    await fireEvent.changeText(screen.getByLabelText('表示名'), 'Alice');
    await fireEvent.press(screen.getByRole('button', { name: 'はじめる' }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({ handle: 'alice', displayName: 'Alice', bio: '' }),
    );
    await waitFor(() => expect(screen).toHavePathname('/home'));
  });

  it('初期 handle のままでは、保存されない', async () => {
    await renderRouter(routes, { initialUrl: '/profile-setup' });

    await fireEvent.changeText(screen.getByLabelText('ハンドル'), 'user_a100000000');
    await fireEvent.press(screen.getByRole('button', { name: 'はじめる' }));

    expect(await screen.findByText('ハンドルを自分で決めてください')).toBeOnTheScreen();
    expect(save).not.toHaveBeenCalled();
  });

  it('handle が重複していたら、エラーを出して画面に残る', async () => {
    save.mockRejectedValue(new ProfileFieldError('handle', 'このハンドルは既に使われています'));
    await renderRouter(routes, { initialUrl: '/profile-setup' });

    await fireEvent.changeText(screen.getByLabelText('ハンドル'), 'taken_one');
    await fireEvent.press(screen.getByRole('button', { name: 'はじめる' }));

    expect(await screen.findByText('このハンドルは既に使われています')).toBeOnTheScreen();
    expect(screen).toHavePathname('/profile-setup');
  });
});
