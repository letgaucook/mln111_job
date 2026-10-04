import { CONFIG } from '../../shared/rules.ts';
import { NAME_RE, NAME_HINT, cleanName } from '../../shared/name.ts';
import { content } from '../content.ts';
import * as game from '../game.ts';
import { claimName, ApiError } from '../api.ts';
import { lastName, rememberName } from '../save.ts';
import { go, type Screen } from '../router.ts';
import { h, hearts, toast } from '../ui/dom.ts';

export const home: Screen = root => {
  const run = game.current();
  if (game.takeOutdatedNotice()) toast('Nội dung đã cập nhật — lượt chơi cũ được làm mới.', 'info', 4000);
  const playing = run?.phase === 'playing' ? run : null;

  const input = h('input', {
    id: 'name', name: 'name', type: 'text', autocomplete: 'nickname', maxlength: 20, required: true,
    placeholder: 'Ví dụ: Phong', value: run?.save.name ?? lastName(), 'aria-describedby': 'name-msg',
  });
  const msg = h('p', { id: 'name-msg', class: 'field__msg', 'aria-live': 'polite' }, NAME_HINT);
  const btn = h('button', { class: 'btn btn--primary btn--lg', type: 'submit' }, playing ? 'Bắt đầu lượt mới' : 'Lên tàu');

  const setError = (text: string) => { msg.textContent = text; msg.classList.add('field__msg--error'); input.setAttribute('aria-invalid', 'true'); };

  async function onSubmit(e: Event) {
    e.preventDefault();
    const name = cleanName(input.value);
    if (!NAME_RE.test(name)) return setError(NAME_HINT);
    if (playing && !confirm('Bắt đầu lượt mới sẽ bỏ lượt đang chơi. Tiếp tục?')) return;

    btn.disabled = true;
    btn.textContent = 'Đang kiểm tra tên…';
    try {
      await claimName(name);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = playing ? 'Bắt đầu lượt mới' : 'Lên tàu';
      if (err instanceof ApiError && (err.status === 409 || err.status === 400)) return setError(err.message);
      // Không có mạng / máy chủ chưa sẵn sàng: vẫn cho chơi, kiểm tra tên lúc nộp điểm
      toast('Chưa kiểm tra được tên (mất kết nối). Tên sẽ được kiểm tra khi nộp điểm.', 'info', 4000);
    }
    rememberName(name);
    game.startRun(name);
    go('/map');
  }

  const continueCard = playing && h('section', { class: 'card continue' },
    h('div', null,
      h('p', { class: 'eyebrow' }, 'Lượt đang chơi'),
      h('p', { class: 'continue__name' }, playing.save.name),
      h('p', { class: 'continue__meta' },
        hearts(playing.state.hearts, CONFIG.maxHearts), ' · ',
        game.atBoss(playing) ? content.boss.title : game.currentStation(playing).title, ' · ',
        `${playing.state.badges}/${content.stations.length} huy hiệu`)),
    h('a', { class: 'btn btn--primary', href: '#/map' }, 'Tiếp tục ▸'));

  const finished = run && run.phase !== 'playing' &&
    h('p', { class: 'muted center' }, h('a', { href: '#/result' }, 'Xem kết quả lượt trước'));

  root.append(h('div', { class: 'home' },
    h('header', { class: 'home__hero' },
      h('div', { class: 'home__lamp', 'aria-hidden': 'true' }),
      h('p', { class: 'eyebrow' }, 'Survival quiz'),
      h('h1', { class: 'home__title' }, 'Chuyến Tàu', h('br'), 'Tri Thức'),
      h('p', { class: 'home__lead' },
        `Chuyến tàu đêm qua ${content.stations.length} ga. Mỗi ga một câu hỏi, sai mất tim. `,
        `Đủ ${content.stations.length} huy hiệu để tới ${content.boss.title}.`)),
    continueCard,
    h('form', { class: 'card home__form', novalidate: true, onsubmit: onSubmit as EventListener },
      h('label', { class: 'field__label', for: 'name' }, 'Tên hành khách'),
      input, msg, btn),
    finished,
    h('nav', { class: 'home__links', 'aria-label': 'Liên kết phụ' },
      h('a', { href: '#/leaderboard' }, 'Bảng xếp hạng'),
      h('a', { href: '#/guide' }, 'Hướng dẫn'),
      h('a', { href: '#/materials' }, 'Tài liệu ôn tập')),
  ));

  input.addEventListener('input', () => {
    msg.textContent = NAME_HINT;
    msg.classList.remove('field__msg--error');
    input.removeAttribute('aria-invalid');
  });
};
