import { z } from 'zod';

const email = z
  .string()
  .trim()
  .min(1, 'メールアドレスを入力してください')
  .email('メールアドレスの形式が正しくありません');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'パスワードを入力してください'),
});

export const signupSchema = z
  .object({
    email,
    password: z
      .string()
      .min(8, 'パスワードは8文字以上にしてください')
      .max(72, 'パスワードは72文字以内にしてください'),
    confirmPassword: z.string().min(1, '確認用パスワードを入力してください'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'パスワードが一致しません',
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
