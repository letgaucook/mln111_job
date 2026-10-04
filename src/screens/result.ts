import { CONFIG } from '../../shared/rules.ts';
import { NAME_RE, NAME_HINT, cleanName } from '../../shared/name.ts';
import { content } from '../content.ts';
import * as game from '../game.ts';
import { submitRun, ApiError } from '../api.ts';
import * as store from '../save.ts';
import { go, replaceRoute, type Screen } from '../router.ts';
import { h, hearts } from '../ui/dom.ts';

export const result: Screen = root => {
  let run = game.current();
  if (!run) return replaceRoute('/');
  if (run.phase === 'playing') return replaceRoute('/map');
  const s = run.state;

  const restart = () => {
    game.startRun(run!.save.name);
    go('/map');
  };

  const links = h('nav', { class: 'result__links' },
    run.phase === 'won'
      ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: restart }, 'Chơi lại')
      : h('button', { class: 'btn btn--primary', type: 'button', onclick: restart }, 'Chơi lại từ đầu'),
    h('a', { class: 'btn btn--ghost', href: '#/leaderboard' }, 'Bảng xếp hạng'),
    h('a', { class: 'btn btn--ghost', href: '#/' }, 'Trang chủ'));

  if (run.phase !== 'won') {
    const reason = run.phase === 'timeout' ? 'Hết giờ ở ' + content.boss.title : 'Hết tim';
    const reached = game.atBoss(run) ? content.boss.title : game.currentStation(run).title;
    root.append(h('div', { class: 'result result--lose' },
      h('p', { class: 'eyebrow' }, 'Tàu quay về ga đầu'),
      h('h1', { class: 'result__title' }, reason),
      h('section', { class: 'card stats' },
        stat('Dừng ở', reached),
        stat('Huy hiệu', `${s.badges}/${content.stations.length}`),
        stat('Tri thức', s.knowledge)),
      h('p', { class: 'muted center' }, 'Lượt mới sẽ bắt đầu lại từ ga 1 với đủ 3 tim.'),
      links));
    return;
  }

  const score = game.scoreOf(run);
  const status = h('p', { class: 'submit__status', 'aria-live': 'polite' });
  const actions = h('div', { class: 'submit__actions' });
  let busy = false;

  async function submit() {
    if (busy || !run) return;
    busy = true;
    actions.replaceChildren();
    status.className = 'submit__status';
    status.textContent = 'Đang nộp điểm…';
    try {
      const r = await submitRun(run.save.name, run.save.seed, run.save.answers);
      run = game.markSubmitted(run);
      status.classList.add('submit__status--ok');
      status.textContent = r.updated ? `Đã lên bảng xếp hạng với tên “${run.save.name}”.` : 'Điểm cũ của bạn cao hơn hoặc bằng — bảng giữ điểm cũ.';
    } catch (err) {
      status.classList.add('submit__status--error');
      if (err instanceof ApiError && err.status === 409) {
        // Tên bị người khác giữ (thường do bắt đầu khi offline) → cho đổi tên rồi nộp lại
        status.textContent = err.message;
        actions.replaceChildren(renameForm());
      } else {
        status.textContent = err instanceof ApiError ? err.message : 'Nộp điểm thất bại';
        actions.replaceChildren(h('button', { class: 'btn btn--primary', type: 'button', onclick: submit }, 'Thử nộp lại'));
      }
    } finally {
      busy = false;
    }
  }

  function renameForm() {
    const input = h('input', { type: 'text', maxlength: 20, value: '', placeholder: 'Tên mới', 'aria-label': 'Tên mới' });
    return h('form', {
      class: 'rename', novalidate: true,
      onsubmit: ((e: Event) => {
        e.preventDefault();
        const name = cleanName(input.value);
        if (!NAME_RE.test(name)) { status.textContent = NAME_HINT; return; }
        run = { ...run!, save: { ...run!.save, name } };
        store.save(run.save);
        store.rememberName(name);
        submit();
      }) as EventListener,
    }, input, h('button', { class: 'btn btn--primary', type: 'submit' }, 'Đổi tên & nộp'));
  }

  // Có mạng trở lại → tự thử nộp
  const onOnline = () => { if (!run?.save.submitted) submit(); };
  window.addEventListener('online', onOnline);

  root.append(h('div', { class: 'result result--win' },
    h('div', { class: 'result__confetti', 'aria-hidden': 'true' }),
    h('p', { class: 'eyebrow' }, `Đã hạ ${content.boss.title}`),
    h('h1', { class: 'result__title' }, 'Chiến thắng!'),
    h('p', { class: 'result__score' }, h('span', { class: 'result__num' }, score), ' điểm'),
    h('section', { class: 'card stats' },
      stat('Tri thức', s.knowledge),
      stat('Tim còn lại', h('span', null, hearts(s.hearts, CONFIG.maxHearts), ` × ${CONFIG.heartBonus}`)),
      stat('Thưởng thắng', `+${CONFIG.winBonus}`)),
    h('section', { class: 'submit' }, status, actions),
    links));

  if (run.save.submitted) status.textContent = 'Điểm của lượt này đã được nộp.';
  else submit();

  return () => window.removeEventListener('online', onOnline);
};

function stat(label: string, value: string | number | Node) {
  return h('div', { class: 'stat' }, h('span', { class: 'stat__label' }, label), h('strong', { class: 'stat__value' }, value));
}
