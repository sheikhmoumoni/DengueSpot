import sharp from "sharp";
import { createHash, randomUUID } from "node:crypto";
import { AppError, type Media } from "../../../packages/domain/src/index";
import { storage } from "../../../packages/providers/src/storage/index";
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export async function prepareImage(bytes: Buffer, claimedMime: string) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
    throw new AppError(
      413,
      "MEDIA_SIZE",
      "Image must be between 1 byte and 8 MB.",
    );
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP";
  const actual = png
    ? "image/png"
    : jpeg
      ? "image/jpeg"
      : webp
        ? "image/webp"
        : null;
  if (!actual || actual !== claimedMime)
    throw new AppError(
      415,
      "MEDIA_TYPE",
      "Upload a valid JPEG, PNG or WebP image.",
    );
  try {
    const image = sharp(bytes, {
      limitInputPixels: 20000000,
      failOn: "warning",
      animated: false,
    });
    const metadata = await image.metadata();
    if ((metadata.pages || 1) > 1 || !metadata.width || !metadata.height)
      throw new Error("Animated/invalid media");
    const derivative = await image
      .clone()
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    const sanitizedOriginal=await sharp(bytes,{limitInputPixels:20000000,failOn:'warning'}).rotate().toFormat(actual==='image/png'?'png':actual==='image/webp'?'webp':'jpeg').toBuffer();
    return {
      derivative,
      sanitizedOriginal,
      width: metadata.width,
      height: metadata.height,
      mime: actual,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  } catch {
    throw new AppError(
      422,
      "MEDIA_DECODE",
      "The image could not be decoded safely. Use a smaller still photo.",
    );
  }
}
export async function storeImage(
  bytes: Buffer,
  mime: string,
  ownerKey: string,
  kind: "before" | "after",
): Promise<Media> {
  const prepared = await prepareImage(bytes, mime);
  const id = randomUUID();
  const originalKey = `originals/${id}.${mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg"}`;
  const derivativeKey = `derivatives/${id}.jpg`;
  const bucket = storage();
  await bucket.put(originalKey, prepared.sanitizedOriginal, mime);
  try {
    await bucket.put(derivativeKey, prepared.derivative, "image/jpeg");
  } catch (error) {
    await bucket.remove(originalKey);
    throw error;
  }
  return {
    id,
    ownerKey,
    reportId: null,
    kind,
    originalKey,
    derivativeKey,
    sha256: prepared.sha256,
    bytes: bytes.length,
    width: prepared.width,
    height: prepared.height,
    mime,
    createdAt: new Date().toISOString(),
    safeForPublic: false,
  };
}
