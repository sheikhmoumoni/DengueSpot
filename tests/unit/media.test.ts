import { it, expect } from "vitest";
import sharp from "sharp";
import { prepareImage } from "../../apps/web/lib/media";
it("strips EXIF from original and derivative and rejects spoofed MIME", async () => {
  const bytes = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#abc" },
  })
    .jpeg()
    .withExif({ IFD0: { Artist: "private identity" } })
    .toBuffer();
  const result = await prepareImage(bytes, "image/jpeg");
  expect((await sharp(result.derivative).metadata()).exif).toBeUndefined();
  expect(
    (await sharp(result.sanitizedOriginal).metadata()).exif,
  ).toBeUndefined();
  await expect(prepareImage(bytes, "image/png")).rejects.toMatchObject({
    status: 415,
  });
  await expect(
    prepareImage(Buffer.from("<svg/>"), "image/jpeg"),
  ).rejects.toMatchObject({ status: 415 });
});
it("rejects oversized media and decode bombs", async () => {
  await expect(
    prepareImage(Buffer.alloc(8 * 1024 * 1024 + 1), "image/jpeg"),
  ).rejects.toMatchObject({ status: 413 });
  const bytes = await sharp({
    create: { width: 5000, height: 5000, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  await expect(prepareImage(bytes, "image/png")).rejects.toMatchObject({
    status: 422,
  });
});
