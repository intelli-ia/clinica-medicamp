import sharp from 'sharp';
import { readdirSync, mkdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';

const inputDir  = './public';
const outputDir = './public/opt';

mkdirSync(outputDir, { recursive: true });

const files = readdirSync(inputDir).filter(f =>
  ['.png', '.jpg', '.jpeg'].includes(extname(f).toLowerCase())
);

for (const file of files) {
  const input  = join(inputDir, file);
  const output = join(outputDir, basename(file, extname(file)) + '.webp');

  await sharp(input)
    .resize({ width: 1400, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(output);

  const inSize  = statSync(input).size;
  const outSize = statSync(output).size;
  const saved   = (((inSize - outSize) / inSize) * 100).toFixed(0);
  console.log(`${file.padEnd(50)} ${(inSize/1e6).toFixed(1)}MB → ${(outSize/1e6).toFixed(2)}MB  (-${saved}%)`);
}

console.log('\nDone! Imagens em /public/opt/');
