import sharp from "sharp";
import { mkdir, copyFile } from "node:fs/promises";
for (const size of [192, 512])
  await sharp("apps/web/public/icon.svg")
    .resize(size, size)
    .png()
    .toFile(`apps/web/public/icon-${size}.png`);
await mkdir("apps/web/public/fonts", { recursive: true });
await copyFile(
  "node_modules/@fontsource-variable/noto-sans-bengali/files/noto-sans-bengali-bengali-wght-normal.woff2",
  "apps/web/public/fonts/noto-bengali.woff2",
);
await copyFile(
  "node_modules/@fontsource-variable/noto-sans-bengali/LICENSE",
  "apps/web/public/fonts/OFL.txt",
);
