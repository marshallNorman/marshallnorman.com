import sharp from 'sharp';
import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const dir = new URL('../public/images/', import.meta.url).pathname;
const files = readdirSync(dir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));

let totalBefore = 0;
let totalAfter = 0;

for (const file of files) {
  const filePath = join(dir, file);
  const before = statSync(filePath).size;
  totalBefore += before;

  const ext = extname(file).toLowerCase();
  const isJpeg = ext === '.jpg' || ext === '.jpeg';

  const buf = await sharp(filePath)
    .resize({ width: 1200, withoutEnlargement: true })
    [isJpeg ? 'jpeg' : 'png']({ quality: 80 })
    .toBuffer();

  await sharp(buf).toFile(filePath);

  const after = statSync(filePath).size;
  totalAfter += after;

  const saved = ((1 - after / before) * 100).toFixed(1);
  console.log(`${file}: ${(before / 1024 / 1024).toFixed(2)} MB → ${(after / 1024 / 1024).toFixed(2)} MB (${saved}% saved)`);
}

console.log(`\nTotal: ${(totalBefore / 1024 / 1024).toFixed(1)} MB → ${(totalAfter / 1024 / 1024).toFixed(1)} MB (${((1 - totalAfter / totalBefore) * 100).toFixed(1)}% saved)`);
