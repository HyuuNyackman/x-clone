import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

// 長辺の上限 (px)。Supabase Free は画像変換が使えないので、アップロード前に端末側で縮小する。
export const MAX_IMAGE_EDGE = 1280;
// 1 枚あたりの目安 (byte)。
export const TARGET_IMAGE_BYTES = 200 * 1024;
// JPEG 品質を下げていく順。目安に収まった時点で止める。
export const QUALITY_STEPS = [0.8, 0.65, 0.5, 0.35] as const;

export type PickedImage = { uri: string; width: number; height: number };
export type ProcessedImage = PickedImage & { bytes: number };

// 長辺が maxEdge を超えるときだけ、縦横比を保って縮める。
export function fitWithin(width: number, height: number, maxEdge = MAX_IMAGE_EDGE) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// 端末のライブラリから画像を 1 枚選ぶ (Web ではファイル選択になる)。キャンセルなら null。
export async function pickImage(): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;
  const { uri, width, height } = result.assets[0];
  return { uri, width, height };
}

async function byteSize(uri: string): Promise<number> {
  const blob = await (await fetch(uri)).blob();
  return blob.size;
}

// 長辺 1280px 以下に縮め、JPEG にして、目安サイズに収まるまで品質を下げる。
// 最低品質でも収まらないときは、そのときの結果を返す (サーバー側の上限 5MiB / 2MiB が最後の砦)。
export async function compressImage(
  image: PickedImage,
  options: { maxEdge?: number; targetBytes?: number } = {},
): Promise<ProcessedImage> {
  const { maxEdge = MAX_IMAGE_EDGE, targetBytes = TARGET_IMAGE_BYTES } = options;
  const size = fitWithin(image.width, image.height, maxEdge);
  const context = ImageManipulator.ImageManipulator.manipulate(image.uri);
  if (size.width !== image.width || size.height !== image.height) context.resize(size);
  const rendered = await context.renderAsync();

  let last: ProcessedImage | null = null;
  for (const quality of QUALITY_STEPS) {
    const saved = await rendered.saveAsync({
      format: ImageManipulator.SaveFormat.JPEG,
      compress: quality,
    });
    last = {
      uri: saved.uri,
      width: saved.width,
      height: saved.height,
      bytes: await byteSize(saved.uri),
    };
    if (last.bytes <= targetBytes) break;
  }
  return last as ProcessedImage;
}
