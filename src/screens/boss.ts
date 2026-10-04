import { CONFIG } from '../../shared/rules.ts';
import { content } from '../content.ts';
import * as game from '../game.ts';
import { go, replaceRoute, type Screen } from '../router.ts';
import { h, porthole, setAmbient } from '../ui/dom.ts';
import { hud } from '../ui/hud.ts';
import { questionView, type QuestionView } from '../ui/question.ts';

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const boss: Screen = root => {
  let run = game.current();
  if (!run) return replaceRoute('/');
  if (run.phase !== 'playing') return replaceRoute('/result');
  if (!game.atBoss(run)) return replaceRoute('/map');   // chưa đủ huy hiệu
  run = game.startBossClock(run);
  if (run.phase !== 'playing') return replaceRoute('/result');

  const total = content.boss.questions.length;
  const bossIds = new Set(content.boss.questions.map(q => q.id));
  const hits = () => run!.save.answers.filter(a => {
    if (!bossIds.has(a.qid)) return false;
    return content.boss.questions.find(q => q.id === a.qid)!.answer === a.chosen;
  }).length;

  // Thanh máu boss: mỗi câu đúng làm mất 1 nấc
  const segs = Array.from({ length: total }, () => h('span', { class: 'bossbar__seg' }));
  const bar = h('div', { class: 'bossbar', role: 'meter', 'aria-label': 'Máu boss', 'aria-valuemin': 0, 'aria-valuemax': total }, segs);
  const updateBar = () => {
    const left = total - hits();
    segs.forEach((s, i) => s.classList.toggle('bossbar__seg--gone', i >= left));
    bar.setAttribute('aria-valuenow', String(left));
  };

  const clock = h('div', { class: 'clock', role: 'timer', 'aria-label': 'Thời gian còn lại' });
  const slot = h('div', { class: 'boss__main' });
  let view: QuestionView | null = null;
  let timer = 0;

  function tick() {
    const ms = game.bossRemainingMs(run!.save);
    clock.textContent = fmt(ms);
    clock.classList.toggle('clock--warn', ms <= 60_000);
    if (ms <= 0) {
      clearInterval(timer);
      view?.lock();
      // Chỉ chuyển nếu lượt chưa kết thúc theo cách khác
      if (game.current()?.phase === 'timeout') replaceRoute('/result');
    }
  }

  function ask() {
    view?.destroy();
    const shown = game.currentQuestion(run!);
    if (!shown) return replaceRoute('/result');
    const n = run!.state.bossAnswered.length + 1;
    view = questionView(shown, `Câu ${n}/${total}`, displayed => {
      if (game.bossRemainingMs(run!.save) <= 0) return tick();   // hết giờ đúng lúc bấm
      const res = game.answer(run!, shown, displayed);
      run = res.run;
      hud.update(run);
      updateBar();
      if (!res.correct) hud.hit();
      const done = run.phase !== 'playing';
      if (done) clearInterval(timer);
      view!.reveal(displayed, {
        correct: res.correct,
        title: res.correct ? 'Trúng đòn! Boss mất 1 nấc máu.' : 'Boss phản đòn — mất 1 tim.',
        note: res.correct ? `+${CONFIG.bossPoint} tri thức` : undefined,
        next: done
          ? { label: run.phase === 'won' ? 'Chiến thắng — xem kết quả ▸' : 'Xem kết quả', onClick: () => go('/result'), kind: run.phase === 'won' ? 'primary' : 'danger' }
          : { label: 'Câu tiếp ▸', onClick: ask, kind: 'danger' },
      });
    });
    slot.replaceChildren(view.el);
  }

  document.body.classList.add('is-boss');
  setAmbient(content.boss.image);
  root.append(h('div', { class: 'boss' },
    h('header', { class: 'boss__head' },
      porthole(content.boss.image, '☠', 'porthole--boss porthole--lg'),
      h('div', { class: 'boss__info' },
        h('h1', { class: 'boss__title' }, content.boss.title),
        content.boss.story && h('p', { class: 'muted' }, content.boss.story),
        bar),
      clock),
    slot));

  updateBar();
  tick();
  timer = window.setInterval(tick, 250);
  ask();

  return () => {
    clearInterval(timer);
    view?.destroy();
    document.body.classList.remove('is-boss');
  };
};
