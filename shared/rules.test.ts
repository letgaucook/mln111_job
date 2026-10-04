import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type Content, type Answer, CONFIG, RuleError,
  replay, finalScore, rollHeal, availableQuestions, initialState,
} from './rules.ts';

// Nội dung giả: 10 trạm × 3 câu, boss 5 câu; đáp án đúng luôn là 0
const q = (id: string) => ({ id, text: id, options: ['a', 'b', 'c', 'd'], answer: 0 });
const content: Content = {
  version: 1,
  stations: Array.from({ length: 10 }, (_, i) => ({
    id: i + 1, questions: [q(`s${i + 1}a`), q(`s${i + 1}b`), q(`s${i + 1}c`)],
  })),
  boss: { timeLimitSec: 300, questions: [1, 2, 3, 4, 5].map(i => q(`b${i}`)) },
};
const right = (qid: string): Answer => ({ qid, chosen: 0 });
const wrong = (qid: string): Answer => ({ qid, chosen: 1 });
const clearAllStations = (): Answer[] => content.stations.map(s => right(s.questions[0].id));
const SEED = 'test-seed';

test('trả lời đúng: nhận huy hiệu, sang trạm 2', () => {
  const s = replay(content, SEED, [right('s1a')]);
  assert.equal(s.badges, 1);
  assert.equal(s.stationIndex, 1);
  assert.equal(s.knowledge, CONFIG.stationPoint);
  assert.equal(s.hearts, 3);
});

test('trả lời sai: mất 1 tim, vẫn ở trạm đó, không được hỏi lại câu vừa sai', () => {
  const s = replay(content, SEED, [wrong('s1a')]);
  assert.equal(s.hearts, 2);
  assert.equal(s.stationIndex, 0);
  assert.ok(!availableQuestions(content, s).some(x => x.id === 's1a'));
  assert.throws(() => replay(content, SEED, [wrong('s1a'), right('s1a')]), RuleError);
});

test('hết bộ câu của trạm thì quay vòng lại từ đầu bộ', () => {
  // dùng seed bất kỳ; 2 câu sai rồi... chỉ còn 1 tim nên sai câu thứ 3 sẽ chết.
  // Kiểm tra trực tiếp bằng state: đã hỏi đủ 3 câu => bộ câu mở lại toàn bộ
  const s = { ...initialState(), hearts: 3, askedInCycle: ['s1a', 's1b', 's1c'] };
  assert.equal(availableQuestions(content, s).length, 3);
});

test('quay vòng thực tế qua replay (trạm 1 có 2 câu)', () => {
  const small: Content = { ...content, stations: [{ id: 1, questions: [q('x1'), q('x2')] }, ...content.stations.slice(1)] };
  const s = replay(small, SEED, [wrong('x1'), wrong('x2')]); // hết bộ, còn 1 tim
  assert.equal(s.hearts, 1);
  const s2 = replay(small, SEED, [wrong('x1'), wrong('x2'), right('x1')]); // x1 hỏi lại được
  assert.equal(s2.stationIndex, 1);
});

test('câu của trạm khác bị từ chối (chặn nhảy cóc)', () => {
  assert.throws(() => replay(content, SEED, [right('s2a')]), RuleError);
  assert.throws(() => replay(content, SEED, [right('b1')]), RuleError);
});

test('đáp án ngoài khoảng bị từ chối', () => {
  assert.throws(() => replay(content, SEED, [{ qid: 's1a', chosen: 4 }]), RuleError);
  assert.throws(() => replay(content, SEED, [{ qid: 's1a', chosen: 1.5 }]), RuleError);
});

test('hết máu => dead, không nhận thêm câu trả lời', () => {
  const s = replay(content, SEED, [wrong('s1a'), wrong('s1b'), wrong('s1c')]);
  assert.equal(s.status, 'dead');
  assert.equal(finalScore(s), 0);
  assert.throws(() => replay(content, SEED, [wrong('s1a'), wrong('s1b'), wrong('s1c'), right('s1a')]), RuleError);
});

test('hồi máu tất định theo seed và không vượt tối đa', () => {
  for (let i = 0; i < 50; i++) assert.equal(rollHeal(`s${i}`, 1), rollHeal(`s${i}`, 1));
  const full = replay(content, SEED, clearAllStations());
  assert.equal(full.hearts, CONFIG.maxHearts);
  assert.equal(full.healedAt.length, 0);
});

test('có seed làm hồi máu khi qua trạm lúc đang thiếu tim', () => {
  const seed = Array.from({ length: 200 }, (_, i) => `seed${i}`).find(sd => rollHeal(sd, 1));
  assert.ok(seed, 'phải tồn tại seed hồi máu với healChance = 0.25');
  const s = replay(content, seed!, [wrong('s1a'), right('s1b')]);
  assert.equal(s.hearts, 3);
  assert.deepEqual(s.healedAt, [1]);
});

test('tỉ lệ hồi máu xấp xỉ healChance', () => {
  const n = 20000;
  let hit = 0;
  for (let i = 0; i < n; i++) if (rollHeal(`r${i}`, (i % 10) + 1)) hit++;
  assert.ok(Math.abs(hit / n - CONFIG.healChance) < 0.02, `tỉ lệ thực tế ${hit / n}`);
});

test('boss: phải trả lời đủ 5 câu, sai trừ máu, không trả lời trùng', () => {
  const base = clearAllStations();
  assert.throws(() => replay(content, SEED, [...base, right('b1'), right('b1')]), RuleError);
  const s = replay(content, SEED, [...base, right('b1'), wrong('b2'), right('b3'), right('b4')]);
  assert.equal(s.status, 'playing');
  assert.equal(s.hearts, 2);
});

test('thắng hoàn hảo: điểm đúng công thức', () => {
  const s = replay(content, SEED, [...clearAllStations(), ...content.boss.questions.map(x => right(x.id))]);
  assert.equal(s.status, 'won');
  // 10 trạm × 10 + 5 boss × 20 + 3 tim × 100 + 300
  assert.equal(finalScore(s), 100 + 100 + 300 + 300);
});

test('chết ở boss', () => {
  const s = replay(content, SEED, [...clearAllStations(), wrong('b1'), wrong('b2'), wrong('b3')]);
  assert.equal(s.status, 'dead');
});

test('replay không làm thay đổi state trung gian (hàm thuần)', () => {
  const a = replay(content, SEED, [wrong('s1a')]);
  const snapshot = JSON.stringify(a);
  replay(content, SEED, [wrong('s1a'), right('s1b')]);
  assert.equal(JSON.stringify(a), snapshot);
});
