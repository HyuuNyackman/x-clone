import { mediaUrl } from '@/features/media/media-url';

describe('mediaUrl', () => {
  const keys = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_MEDIA_BASE_URL'] as const;
  const original = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  afterEach(() => {
    for (const k of keys) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  it('キーから Supabase Storage の公開 URL を組み立てる', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321/';
    delete process.env.EXPO_PUBLIC_MEDIA_BASE_URL;
    expect(mediaUrl('post-media', 'u1/a.jpg')).toBe(
      'http://127.0.0.1:54321/storage/v1/object/public/post-media/u1/a.jpg',
    );
  });

  it('EXPO_PUBLIC_MEDIA_BASE_URL があれば、保存先をそちらに切り替える', () => {
    process.env.EXPO_PUBLIC_MEDIA_BASE_URL = 'https://cdn.example.com/';
    expect(mediaUrl('avatars', 'u1/a.jpg')).toBe('https://cdn.example.com/avatars/u1/a.jpg');
  });
});
