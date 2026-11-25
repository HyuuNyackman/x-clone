import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import ComposeScreen from '@/app/compose';
import { useCreatePost } from '@/features/posts/use-posts';

jest.mock('@/features/posts/use-posts', () => ({ useCreatePost: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const mutateAsync = jest.fn();
const routes = { compose: ComposeScreen, home: () => null };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useCreatePost).mockReturnValue({ mutateAsync, isPending: false } as never);
});

describe('投稿作成画面', () => {
  it('入力した文字数に合わせて、残り文字数が変わる', async () => {
    await renderRouter(routes, { initialUrl: '/compose' });
    expect(screen.getByLabelText('残り文字数')).toHaveTextContent('280');
    await fireEvent.changeText(screen.getByLabelText('本文'), 'あいう');
    expect(screen.getByLabelText('残り文字数')).toHaveTextContent('277');
  });

  it('本文が空のあいだは、投稿できない', async () => {
    await renderRouter(routes, { initialUrl: '/compose' });
    await fireEvent.press(screen.getByRole('button', { name: '投稿する' }));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('280文字を超えると、投稿できない', async () => {
    await renderRouter(routes, { initialUrl: '/compose' });
    await fireEvent.changeText(screen.getByLabelText('本文'), 'a'.repeat(281));
    expect(screen.getByLabelText('残り文字数')).toHaveTextContent('-1');
    await fireEvent.press(screen.getByRole('button', { name: '投稿する' }));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('本文を入れて投稿すると、その本文で投稿が呼ばれる', async () => {
    mutateAsync.mockResolvedValue(undefined);
    await renderRouter(routes, { initialUrl: '/compose' });
    await fireEvent.changeText(screen.getByLabelText('本文'), 'こんにちは');
    await fireEvent.press(screen.getByRole('button', { name: '投稿する' }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ body: 'こんにちは', images: [] }),
    );
  });

  it('投稿に失敗すると、エラーが出る', async () => {
    mutateAsync.mockRejectedValue(new Error('投稿できませんでした: boom'));
    await renderRouter(routes, { initialUrl: '/compose' });
    await fireEvent.changeText(screen.getByLabelText('本文'), 'x');
    await fireEvent.press(screen.getByRole('button', { name: '投稿する' }));
    expect(await screen.findByText('投稿できませんでした: boom')).toBeTruthy();
  });
});
