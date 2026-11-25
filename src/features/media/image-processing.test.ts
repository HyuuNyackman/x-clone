import * as ImageManipulator from 'expo-image-manipulator';

import {
  compressImage,
  fitWithin,
  MAX_IMAGE_EDGE,
  TARGET_IMAGE_BYTES,
} from '@/features/media/image-processing';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: { manipulate: jest.fn() },
}));

describe('fitWithin', () => {
  it('長辺が上限以内なら、そのまま', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('長辺を 1280px に縮め、縦横比を保つ', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: MAX_IMAGE_EDGE, height: 960 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 960, height: MAX_IMAGE_EDGE });
  });
});

describe('compressImage', () => {
  const resize = jest.fn();
  const saveAsync = jest.fn();
  const sizes: number[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    sizes.length = 0;
    const context = {
      resize,
      renderAsync: jest.fn().mockResolvedValue({ saveAsync }),
    };
    jest.mocked(ImageManipulator.ImageManipulator.manipulate).mockReturnValue(context as never);
    saveAsync.mockImplementation(async () => ({
      uri: 'file:///out.jpg',
      width: 1280,
      height: 960,
    }));
    globalThis.fetch = jest.fn(async () => ({
      blob: async () => ({ size: sizes.shift() ?? 0 }),
    })) as never;
  });

  it('大きい画像は 1280px に縮めてから保存する', async () => {
    sizes.push(100 * 1024);
    await compressImage({ uri: 'file:///in.jpg', width: 4000, height: 3000 });
    expect(resize).toHaveBeenCalledWith({ width: 1280, height: 960 });
  });

  it('目安 (200KB) に収まったら、そこで品質を下げるのをやめる', async () => {
    sizes.push(500 * 1024, 150 * 1024);
    const result = await compressImage({ uri: 'file:///in.jpg', width: 1000, height: 800 });
    expect(resize).not.toHaveBeenCalled();
    expect(saveAsync).toHaveBeenCalledTimes(2);
    expect(result.bytes).toBeLessThanOrEqual(TARGET_IMAGE_BYTES);
  });

  it('最低品質でも収まらないときは、最後の結果を返す', async () => {
    sizes.push(900 * 1024, 800 * 1024, 700 * 1024, 600 * 1024);
    const result = await compressImage({ uri: 'file:///in.jpg', width: 1000, height: 800 });
    expect(saveAsync).toHaveBeenCalledTimes(4);
    expect(result.bytes).toBe(600 * 1024);
  });
});
