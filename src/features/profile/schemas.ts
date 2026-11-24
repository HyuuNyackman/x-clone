import { z } from 'zod';

// DB の制約 (profiles_handle_format / profiles_display_name_length / profiles_bio_length) と揃える。
export const profileSchema = z.object({
  handle: z
    .string()
    .trim()
    .regex(
      /^[a-z0-9_]{3,15}$/,
      'ハンドルは半角の小文字英数字とアンダースコアで、3〜15文字にしてください',
    ),
  displayName: z
    .string()
    .trim()
    .min(1, '表示名を入力してください')
    .max(50, '表示名は50文字以内にしてください'),
  bio: z.string().trim().max(160, '自己紹介は160文字以内にしてください'),
});

export type ProfileValues = z.infer<typeof profileSchema>;
