import { z } from 'zod';

// DB の制約 (posts_body_length / posts_body_required) と揃える。
export const POST_MAX_LENGTH = 280;

export const postSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, '本文を入力してください')
    .max(POST_MAX_LENGTH, `本文は${POST_MAX_LENGTH}文字以内にしてください`),
});

export type PostValues = z.infer<typeof postSchema>;
