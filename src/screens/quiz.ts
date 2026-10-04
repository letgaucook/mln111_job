import { CONFIG } from '../../shared/rules.ts';
import { content } from '../content.ts';
import * as game from '../game.ts';
import { go, replaceRoute, type Screen } from '../router.ts';
import { h, porthole, setAmbient, toast } from '../ui/dom.ts';
import { hud } from '../ui/hud.ts';
import { questionView, type QuestionView } from '../ui/question.ts';

export const quiz: Screen = (root, [idParam]) => {
  let run = game.current();
  if (!run) return replaceRoute('/');
  if (run.phase !== 'playing') return replaceRoute('/result');
  const station = game.atBoss(run) ? null : game.currentStation(run);
  // Guard: chỉ vào được đúng ga hiện tại
  if (!station || String(station.id) !== idParam) return replaceRoute('/map');

  const index = content.stations.indexOf(station);
  const slot = h('div', { class: 'ticket__main' });
  let view: QuestionView | null = null;

  function ask() {
    view?.destroy();
    const shown = game.currentQuestion(run!);
    if (!shown) return replaceRoute('/map');
    const tries = run!.state.askedInCycle.length;
    view = questionView(shown, tries ? `Câu khác · lần thử ${tries + 1}` : 'Câu hỏi', displayed => {
      const res = game.answer(run!, shown, displayed);
      run = res.run;
      hud.update(run);

      if (res.correct) {
        if (res.healed) toast('+1 ❤️ Hồi máu khi qua ga!', 'good');
        const toBoss = game.atBoss(run);
        view!.reveal(displayed, {
          correct: true,
          title: `Chính xác! Nhận huy hiệu “${station!.badge}”`,
          note: `+${CONFIG.stationPoint} tri thức`,
          next: { label: toBoss ? `Tới ${content.boss.title} ▸` : 'Tàu chạy tiếp ▸', onClick: () => go('/map') },
        });
        slot.closest('.ticket')?.classList.add('ticket--punched');
        return;
      }

      hud.hit();
      const dead = run.phase === 'dead';
      view!.reveal(displayed, {
        correct: false,
        title: dead ? 'Sai rồi — bạn đã hết tim.' : 'Sai rồi — mất 1 tim.',
        note: dead ? 'Tàu sẽ quay về ga đầu.' : 'Bạn vẫn ở ga này và nhận một câu khác.',
        next: dead
          ? { label: 'Xem kết quả', onClick: () => go('/result'), kind: 'danger' }
          : { label: 'Nhận câu khác ▸', onClick: ask },
      });
    });
    slot.replaceChildren(view.el);
  }

  setAmbient(station.image);
  root.append(h('article', { class: 'ticket' },
    h('aside', { class: 'ticket__stub' },
      porthole(station.image, String(index + 1), 'porthole--lg'),
      h('p', { class: 'eyebrow' }, `Ga ${index + 1}/${content.stations.length}`),
      h('h1', { class: 'ticket__title' }, station.title),
      h('p', { class: 'ticket__topic' }, station.topic),
      h('p', { class: 'ticket__story' }, station.story)),
    slot));
  ask();

  return () => view?.destroy();
};
