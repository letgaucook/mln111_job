// Khối câu hỏi dùng chung cho Quiz và Boss: 4 nút đáp án (phím 1–4), phản hồi đúng/sai + giải thích
import type { Shown } from '../game.ts';
import { h } from './dom.ts';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export type Feedback = {
  correct: boolean;
  title: string;
  note?: string;
  next: { label: string; onClick: () => void; kind?: 'primary' | 'danger' };
};

export type QuestionView = {
  el: HTMLElement;
  /** Hiển thị kết quả sau khi người chơi chọn */
  reveal(displayed: number, fb: Feedback): void;
  lock(): void;
  destroy(): void;
};

export function questionView(shown: Shown, label: string, onPick: (displayed: number) => void): QuestionView {
  let locked = false;
  const { question, order } = shown;

  const buttons = order.map((orig, i) =>
    h('button', { class: 'option', type: 'button', 'data-key': i + 1, onclick: () => pick(i) },
      h('kbd', { class: 'option__key', 'aria-hidden': 'true' }, LETTERS[i]),
      h('span', { class: 'option__text' }, question.options[orig])));

  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const el = h('section', { class: 'question' },
    h('p', { class: 'eyebrow' }, label),
    h('h2', { class: 'question__text' }, question.text),
    h('div', { class: 'options', role: 'group', 'aria-label': 'Các đáp án' }, buttons),
    h('p', { class: 'question__hint muted' }, 'Phím tắt: 1–4 để chọn'),
    feedback);

  function pick(i: number) {
    if (locked) return;
    locked = true;
    buttons.forEach(b => (b.disabled = true));
    onPick(i);
  }

  function onKey(e: KeyboardEvent) {
    if (locked || e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const n = Number(e.key);
    if (n >= 1 && n <= buttons.length) { e.preventDefault(); pick(n - 1); }
  }
  document.addEventListener('keydown', onKey);

  return {
    el,
    lock() { locked = true; buttons.forEach(b => (b.disabled = true)); },
    reveal(displayed, fb) {
      buttons[displayed].classList.add(fb.correct ? 'option--right' : 'option--wrong');
      buttons[displayed].setAttribute('aria-label', `${buttons[displayed].textContent} — ${fb.correct ? 'đúng' : 'sai'}`);
      const right = order.indexOf(question.answer);
      if (!fb.correct) buttons[right].classList.add('option--answer');

      const next = h('button', { class: `btn btn--${fb.next.kind ?? 'primary'}`, type: 'button', onclick: fb.next.onClick }, fb.next.label);
      feedback.replaceChildren(h('div', { class: `feedback__box feedback__box--${fb.correct ? 'right' : 'wrong'}` },
        h('p', { class: 'feedback__title' }, fb.correct ? '✓ ' : '✗ ', fb.title),
        question.explain && h('p', { class: 'feedback__explain' }, question.explain),
        fb.note && h('p', { class: 'feedback__note' }, fb.note),
        next));
      next.focus();
    },
    destroy() { document.removeEventListener('keydown', onKey); },
  };
}
