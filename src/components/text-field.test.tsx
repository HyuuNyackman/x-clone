import { fireEvent, render, screen } from '@testing-library/react-native';
import { useForm, useWatch } from 'react-hook-form';

import { TextField } from '@/components/text-field';

type Values = { email: string };

// フォームの値とエラーを、TextField に渡すだけの小さな画面。
function Harness({ onValue }: { onValue?: (value: string) => void }) {
  const { control } = useForm<Values>({
    defaultValues: { email: '' },
    mode: 'onChange',
  });
  const email = useWatch({ control, name: 'email' });
  onValue?.(email);
  return <TextField control={control} name="email" label="メールアドレス" />;
}

describe('TextField', () => {
  it('ラベルを表示し、入力欄にも同じラベルが付く', async () => {
    await render(<Harness />);
    expect(screen.getByText('メールアドレス')).toBeOnTheScreen();
    expect(screen.getByLabelText('メールアドレス')).toBeOnTheScreen();
  });

  it('入力した文字が、フォームの値に反映される', async () => {
    const onValue = jest.fn();
    await render(<Harness onValue={onValue} />);
    await fireEvent.changeText(screen.getByLabelText('メールアドレス'), 'user@example.com');
    expect(onValue).toHaveBeenLastCalledWith('user@example.com');
  });
});
