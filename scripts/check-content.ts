// npm run check-content — kiểm tra content/stations.json trước khi deploy
import { readFileSync } from 'node:fs';

const EXPECTED_STATIONS = 10;
const MIN_PER_STATION = 3;
const RECOMMENDED_PER_STATION = 5;
const BOSS_QUESTIONS = 5;

const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);

let c: any;
try {
  c = JSON.parse(readFileSync(new URL('../content/stations.json', import.meta.url), 'utf8'));
} catch (e) {
  console.error('✗ Không đọc được content/stations.json:', (e as Error).message);
  process.exit(1);
}

const seen = new Set<string>();
let placeholders = 0;
function checkQuestion(q: any, where: string) {
  if (!q || typeof q !== 'object') return err(`${where}: câu hỏi không phải object`);
  const tag = `${where} / ${q.id ?? '(thiếu id)'}`;
  if (typeof q.id !== 'string' || !q.id) err(`${tag}: thiếu id`);
  else if (seen.has(q.id)) err(`${tag}: id bị trùng`);
  else seen.add(q.id);
  if (typeof q.text !== 'string' || !q.text.trim()) err(`${tag}: thiếu text`);
  if (!Array.isArray(q.options) || q.options.length !== 4) err(`${tag}: cần đúng 4 options`);
  else if (q.options.some((o: unknown) => typeof o !== 'string' || !o.trim())) err(`${tag}: có option rỗng`);
  else if (new Set(q.options.map((o: string) => o.trim())).size !== 4) err(`${tag}: có option trùng nhau`);
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) err(`${tag}: answer phải là số nguyên 0–3`);
  if (q.explain !== undefined && typeof q.explain !== 'string') err(`${tag}: explain phải là chuỗi`);
  const all = [q.text, ...(q.options ?? [])].join(' ');
  if (/cả\s+[A-D]\s+(và|,)\s+[A-D]|tất cả (các )?đáp án/i.test(all)) {
    warnings.push(`${tag}: có cụm "cả A và B"/"tất cả đáp án" — đáp án bị xáo nên dễ sai nghĩa`);
  }
  if (/\[MẪU\]/.test(all)) placeholders++;
}

if (!Number.isInteger(c.version) || c.version < 1) err('version phải là số nguyên ≥ 1');

if (!Array.isArray(c.stations)) err('stations phải là mảng');
else {
  if (c.stations.length !== EXPECTED_STATIONS) err(`cần đúng ${EXPECTED_STATIONS} trạm, đang có ${c.stations.length}`);
  const ids = new Set<number>();
  c.stations.forEach((s: any, i: number) => {
    const where = `trạm #${i + 1}`;
    if (!Number.isInteger(s.id)) err(`${where}: id phải là số nguyên`);
    else if (ids.has(s.id)) err(`${where}: id trạm ${s.id} bị trùng`);
    else ids.add(s.id);
    for (const f of ['title', 'topic', 'story', 'badge']) {
      if (typeof s[f] !== 'string' || !s[f].trim()) err(`${where}: thiếu ${f}`);
    }
    if (!Array.isArray(s.questions)) return err(`${where}: thiếu questions`);
    if (s.questions.length < MIN_PER_STATION) err(`${where}: cần ≥ ${MIN_PER_STATION} câu, đang có ${s.questions.length}`);
    else if (s.questions.length < RECOMMENDED_PER_STATION) warnings.push(`${where}: nên có ≥ ${RECOMMENDED_PER_STATION} câu`);
    s.questions.forEach((q: any) => checkQuestion(q, where));
  });
}

if (!c.boss || typeof c.boss !== 'object') err('thiếu boss');
else {
  if (c.boss.timeLimitSec !== undefined && !(Number.isInteger(c.boss.timeLimitSec) && c.boss.timeLimitSec > 0)) {
    err('boss.timeLimitSec phải là số nguyên dương');
  }
  if (!Array.isArray(c.boss.questions) || c.boss.questions.length !== BOSS_QUESTIONS) {
    err(`boss cần đúng ${BOSS_QUESTIONS} câu`);
  } else c.boss.questions.forEach((q: any) => checkQuestion(q, 'boss'));
}

if (placeholders) warnings.push(`${placeholders} câu vẫn là nội dung mẫu [MẪU]`);
for (const w of warnings) console.warn('⚠', w);
for (const e of errors) console.error('✗', e);
if (errors.length) {
  console.error(`\n${errors.length} lỗi, ${warnings.length} cảnh báo.`);
  process.exit(1);
}
console.log(`✓ Nội dung hợp lệ (${seen.size} câu hỏi, ${warnings.length} cảnh báo).`);
