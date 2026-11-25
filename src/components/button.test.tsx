import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '@/components/button';

describe('Button', () => {
  it('ラベルを表示する', async () => {
    await render(<Button label="ログイン" />);
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeOnTheScreen();
  });

  it('押すと、onPress が呼ばれる', async () => {
    const onPress = jest.fn();
    await render(<Button label="ログイン" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'ログイン' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled のときは、押しても onPress が呼ばれない', async () => {
    const onPress = jest.fn();
    await render(<Button label="ログイン" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'ログイン' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
