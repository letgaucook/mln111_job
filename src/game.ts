// Phiên chơi: ghép save.ts (dữ liệu thô) với shared/rules.ts (luật) thành trạng thái dùng cho UI
import {
  replay, applyAnswer, availableQuestions, isAtBoss, finalScore,
  type RunState, type Question,
} from '../shared/rules.ts';
import { content, BOSS_TIME_LIMIT_SEC } from './content.ts';
import * as store from './save.ts';
import type { Save } from './save.ts';

export type Phase = 'playing' | 'dead' | 'won' | 'timeout';
export type Run = { save: Save; state: RunState; phase: Phase };

let outdatedNotice = false;

function build(save: Save): Run {
  const state = replay(content, save.seed, save.answers);
  let phase: Phase = state.status;
  if (phase === 'playing' && isAtBoss(content, state) && bossRemainingMs(save) <= 0) phase = 'timeout';
  return { save, state, phase };
}

/** Run hiện tại (kể cả đã kết thúc), hoặc null nếu chưa có / không hợp lệ. */
export function current(): Run | null {
  const save = store.load();
  if (!save) return null;
  if (save.contentVersion !== content.version) {
    store.clear();
    outdatedNotice = true;
    return null;
  }
  try { return build(save); }
  catch { store.clear(); return null; }        // save hỏng hoặc không khớp nội dung
}

/** true một lần nếu save cũ vừa bị bỏ vì nội dung đã cập nhật */
export function takeOutdatedNotice(): boolean {
  const v = outdatedNotice;
  outdatedNotice = false;
  return v;
}

export function startRun(name: string): Run {
  const save: Save = { name, contentVersion: content.version, seed: crypto.randomUUID(), answers: [] };
  store.save(save);
  return build(save);
}

export function bossRemainingMs(save: Save, now = Date.now()): number {
  const limit = BOSS_TIME_LIMIT_SEC * 1000;
  return save.bossStartedAt === undefined ? limit : save.bossStartedAt + limit - now;
}

/** Bắt đầu đồng hồ boss (chỉ lần đầu vào boss; reload không đặt lại). */
export function startBossClock(run: Run): Run {
  if (run.save.bossStartedAt !== undefined) return run;
  const save = { ...run.save, bossStartedAt: Date.now() };
  store.save(save);
  return build(save);
}

const randInt = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export type Shown = { question: Question; order: number[] };

/** Câu đang hỏi. Giữ nguyên qua reload (lưu trong save.pending) để không "đổi câu" bằng F5. */
export function currentQuestion(run: Run): Shown | null {
  if (run.phase !== 'playing') return null;
  const allowed = availableQuestions(content, run.state);
  if (!allowed.length) return null;
  const p = run.save.pending;
  const kept = p && allowed.find(q => q.id === p.qid);
  if (kept && p.order.length === kept.options.length) return { question: kept, order: p.order };

  const question = allowed[randInt(allowed.length)];
  const order = shuffled(question.options.length);
  run.save = { ...run.save, pending: { qid: question.id, order } };
  store.save(run.save);
  return { question, order };
}

export type AnswerResult = {
  run: Run; question: Question; chosen: number; correct: boolean; healed: boolean;
};

/** Trả lời câu đang hiển thị; `displayed` là vị trí nút người chơi bấm. */
export function answer(run: Run, shown: Shown, displayed: number): AnswerResult {
  const chosen = shown.order[displayed];
  const prev = run.state;
  const next = applyAnswer(content, run.save.seed, prev, { qid: shown.question.id, chosen });
  const save: Save = { ...run.save, answers: [...run.save.answers, { qid: shown.question.id, chosen }] };
  delete save.pending;
  store.save(save);
  return {
    run: build(save), question: shown.question, chosen,
    correct: chosen === shown.question.answer,
    healed: next.healedAt.length > prev.healedAt.length,
  };
}

export function markSubmitted(run: Run): Run {
  const save = { ...run.save, submitted: true };
  store.save(save);
  return { ...run, save };
}

export const atBoss = (run: Run) => isAtBoss(content, run.state);
export const scoreOf = (run: Run) => finalScore(run.state);
export const currentStation = (run: Run) => content.stations[run.state.stationIndex];
