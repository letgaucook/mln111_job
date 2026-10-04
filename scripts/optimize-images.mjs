// npm run images — chuyển ảnh gốc trong art/*.png thành public/images/*.webp
//   station-*.png, boss.png → cắt vào khung cửa sổ, 512×512, ≤ 80 KB
//   og.png                  → 1200×630, ≤ 200 KB
//   bg.png (hoặc og.png)    → ảnh nền 1920×1080, ≤ 260 KB
import sharp from 'sharp';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';

const SRC = 'art';
const OUT = 'public/images';
// Ảnh AI đã có sẵn khung cửa sổ tròn ~85% khung hình → cắt phần giữa để khớp khung tròn của game
const WINDOW_CROP = 0.84;

mkdirSync(OUT, { recursive: true });

/** Giảm quality dần tới khi file nhỏ hơn giới hạn */
async function toWebp(pipeline, maxBytes) {
  for (let q = 82; q >= 40; q -= 6) {
    const buf = await pipeline.clone().webp({ quality: q, effort: 6 }).toBuffer();
    if (buf.length <= maxBytes || q <= 46) return { buf, q };
  }
}

/** Bỏ viền trắng quanh ảnh ngang: tự dò độ dày viền (lấy theo pixel góc), cắt thêm vài px khử răng cưa */
async function trimEdge(file) {
  const { info } = await sharp(file).trim({ threshold: 40 }).toBuffer({ resolveWithObject: true });
  const pad = 6;
  return sharp(file).extract({
    left: -info.trimOffsetLeft + pad, top: -info.trimOffsetTop + pad,
    width: info.width - 2 * pad, height: info.height - 2 * pad,
  });
}

const files = readdirSync(SRC).filter(f => /\.(png|jpe?g)$/i.test(f));
if (!files.length) { console.error(`Không có ảnh trong ${SRC}/`); process.exit(1); }
const hasBg = files.some(f => /^bg\./i.test(f));

for (const file of files) {
  const name = file.replace(/\.(png|jpe?g)$/i, '');
  const img = sharp(`${SRC}/${file}`);
  const { width, height } = await img.metadata();
  const jobs = [];   // [tên xuất, pipeline, giới hạn byte]

  if (name === 'og' || name === 'bg') {
    const src = `${SRC}/${file}`;
    if (name === 'og') jobs.push(['og', (await trimEdge(src)).resize(1200, 630, { fit: 'cover' }), 200 * 1024]);
    // Ảnh nền: dùng art/bg.png nếu có, không thì lấy luôn ảnh OG (cảnh tàu đêm)
    if (name === 'bg' || !hasBg) jobs.push(['bg', (await trimEdge(src)).resize(1920, 1080, { fit: 'cover' }), 260 * 1024]);
  } else {
    const side = Math.round(Math.min(width, height) * WINDOW_CROP);
    jobs.push([name, img.extract({
      left: Math.round((width - side) / 2), top: Math.round((height - side) / 2), width: side, height: side,
    }).resize(512, 512), 80 * 1024]);
  }

  for (const [out, pipeline, max] of jobs) {
    const { buf, q } = await toWebp(pipeline.flatten({ background: '#0f1424' }), max);
    writeFileSync(`${OUT}/${out}.webp`, buf);
    console.log(`${buf.length <= max ? '✓' : '⚠'} ${out}.webp  ${(buf.length / 1024).toFixed(0)} KB  (quality ${q})`);
  }
}
