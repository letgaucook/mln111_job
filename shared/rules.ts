// shared/rules.ts — luật chơi dùng chung cho client và server (api/leaderboard.ts)
// Không phụ thuộc DOM, không phụ thuộc Node: chỉ là hàm thuần.

export type Question = { id: string; text: string; options: string[]; answer: number; explain?: string };
export type Station = { id: number; questions: Question[] };
export type Content = {
  version: number;
  stations: Station[];
  boss: { timeLimitSec: number; questions: Question[] };
};
export type Answer = { qid: string; chosen: number };

export const CONFIG = {
  maxHearts: 3,
  healChance: 0.25,   // xác suất hồi 1 tim mỗi khi qua trạm (nếu chưa đầy)
  stationPoint: 10,
  bossPoint: 20,
  heartBonus: 100,
  winBonus: 300,
} as const;

export type RunState = {
  status: 'playing' | 'dead' | 'won';
  hearts: number;
  knowledge: number;
  badges: number;
  stationIndex: number;          // 0..stations.length-1; = stations.length nghĩa là đang ở boss
  askedInCycle: string[];        // câu đã hỏi ở trạm hiện tại trong vòng hiện tại
  bossAnswered: string[];
  healedAt: number[];            // id các trạm đã hồi máu (để UI hiển thị)
};

export class RuleError extends Error {}

export function initialState(): RunState {
  return {
    status: 'playing', hearts: CONFIG.maxHearts, knowledge: 0, badges: 0,
    stationIndex: 0, askedInCycle: [], bossAnswered: [], healedAt: [],
  };
}

// ---- RNG tất định: cùng seed + cùng trạm => cùng kết quả hồi máu (server tái hiện được)
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function rollHeal(seed: string, stationId: number): boolean {
  return mulberry32(hashString(`${seed}:heal:${stationId}`))() < CONFIG.healChance;
}

export const isAtBoss = (c: Content, s: RunState) => s.stationIndex >= c.stations.length;

/** Câu còn được phép hỏi ở trạm hiện tại (tự quay vòng khi hết bộ câu). */
export function availableQuestions(c: Content, s: RunState): Question[] {
  if (s.status !== 'playing') return [];
  if (isAtBoss(c, s)) return c.boss.questions.filter(q => !s.bossAnswered.includes(q.id));
  const pool = c.stations[s.stationIndex].questions;
  const left = pool.filter(q => !s.askedInCycle.includes(q.id));
  return left.length ? left : pool;
}

/** Áp dụng 1 câu trả lời. Ném RuleError nếu câu trả lời không hợp lệ. Không sửa state cũ. */
export function applyAnswer(c: Content, seed: string, prev: RunState, a: Answer): RunState {
  if (prev.status !== 'playing') throw new RuleError('Lượt chơi đã kết thúc');
  const s: RunState = {
    ...prev,
    askedInCycle: [...prev.askedInCycle],
    bossAnswered: [...prev.bossAnswered],
    healedAt: [...prev.healedAt],
  };

  const allowed = availableQuestions(c, s);
  const q = allowed.find(x => x.id === a.qid);
  if (!q) throw new RuleError(`Câu ${a.qid} không hợp lệ ở vị trí hiện tại`);
  if (!Number.isInteger(a.chosen) || a.chosen < 0 || a.chosen >= q.options.length) {
    throw new RuleError(`Đáp án ${a.chosen} không hợp lệ`);
  }
  const correct = a.chosen === q.answer;

  if (isAtBoss(c, s)) {
    s.bossAnswered.push(q.id);
    if (correct) s.knowledge += CONFIG.bossPoint;
    else s.hearts -= 1;
    if (s.hearts <= 0) s.status = 'dead';
    else if (s.bossAnswered.length === c.boss.questions.length) s.status = 'won';
    return s;
  }

  // Trạm thường: cần 1 câu đúng để qua trạm
  if (allowed.length === c.stations[s.stationIndex].questions.length) s.askedInCycle = []; // bắt đầu vòng mới
  s.askedInCycle.push(q.id);

  if (!correct) {
    s.hearts -= 1;
    if (s.hearts <= 0) s.status = 'dead';
    return s;
  }

  const station = c.stations[s.stationIndex];
  s.knowledge += CONFIG.stationPoint;
  s.badges += 1;
  if (s.hearts < CONFIG.maxHearts && rollHeal(seed, station.id)) {
    s.hearts += 1;
    s.healedAt.push(station.id);
  }
  s.stationIndex += 1;
  s.askedInCycle = [];
  return s;
}

/** Tính lại toàn bộ trạng thái từ danh sách câu trả lời. Dùng cho cả "tiếp tục chơi" và server chấm lại. */
export function replay(c: Content, seed: string, answers: Answer[]): RunState {
  if (!Array.isArray(answers)) throw new RuleError('answers phải là mảng');
  return answers.reduce((s, a) => applyAnswer(c, seed, s, a), initialState());
}

export function finalScore(s: RunState): number {
  return s.status === 'won' ? s.knowledge + s.hearts * CONFIG.heartBonus + CONFIG.winBonus : 0;
}
