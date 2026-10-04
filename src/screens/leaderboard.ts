import { CONFIG } from '../../shared/rules.ts';
import { nameKey } from '../../shared/name.ts';
import { fetchLeaderboard, ApiError, type LeaderRow } from '../api.ts';
import { lastName } from '../save.ts';
import type { Screen } from '../router.ts';
import { h, hearts } from '../ui/dom.ts';

export const leaderboard: Screen = root => {
  const body = h('div', { class: 'board__body', 'aria-live': 'polite' }, h('p', { class: 'muted center' }, 'Đang tải…'));
  const me = lastName() ? nameKey(lastName()) : '';
  let alive = true;

  const isMe = (r: LeaderRow) => !!me && nameKey(r.name) === me;

  async function load() {
    body.replaceChildren(h('p', { class: 'muted center' }, 'Đang tải…'));
    try {
      const rows = await fetchLeaderboard();
      if (alive) render(rows);
    } catch (err) {
      if (!alive) return;
      body.replaceChildren(h('div', { class: 'center' },
        h('p', { class: 'error' }, err instanceof ApiError ? err.message : 'Không tải được bảng xếp hạng'),
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: load }, 'Thử lại')));
    }
  }

  function render(rows: LeaderRow[]) {
    if (!rows.length) {
      body.replaceChildren(h('p', { class: 'muted center' }, 'Chưa có ai về đích. Bạn sẽ là người đầu tiên?'));
      return;
    }
    const podium = rows.slice(0, 3).map((r, i) =>
      h('li', { class: `podium__item podium__item--${i + 1}${isMe(r) ? ' is-me' : ''}` },
        h('span', { class: 'podium__rank', 'aria-label': `Hạng ${i + 1}` }, String(i + 1)),
        h('span', { class: 'podium__name' }, r.name),
        h('strong', { class: 'podium__score' }, r.score),
        hearts(r.hearts, CONFIG.maxHearts)));
    const rest = rows.slice(3).map((r, i) =>
      h('li', { class: `rank${isMe(r) ? ' is-me' : ''}` },
        h('span', { class: 'rank__no' }, String(i + 4)),
        h('span', { class: 'rank__name' }, r.name, isMe(r) && h('span', { class: 'tag' }, 'Bạn')),
        hearts(r.hearts, CONFIG.maxHearts),
        h('strong', { class: 'rank__score' }, r.score)));
    body.replaceChildren(
      h('ol', { class: 'podium' }, podium),
      rest.length ? h('ol', { class: 'ranks', start: 4 }, rest) : '');
  }

  root.append(h('div', { class: 'board' },
    h('p', { class: 'eyebrow' }, 'Top 10'),
    h('h1', null, 'Bảng xếp hạng'),
    body,
    h('nav', { class: 'result__links' },
      h('a', { class: 'btn btn--ghost', href: '#/' }, 'Trang chủ'),
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: load }, 'Làm mới'))));
  load();

  return () => { alive = false; };
};
