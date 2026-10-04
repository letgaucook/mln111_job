import { content } from '../content.ts';
import * as game from '../game.ts';
import { replaceRoute, type Screen } from '../router.ts';
import { h, porthole, setAmbient } from '../ui/dom.ts';

export const map: Screen = root => {
  const run = game.current();
  if (!run) return replaceRoute('/');
  if (run.phase !== 'playing') return replaceRoute('/result');

  const idx = run.state.stationIndex;
  const atBoss = game.atBoss(run);

  const stops = content.stations.map((s, i) => {
    const state = i < idx ? 'done' : i === idx ? 'current' : 'locked';
    const healed = run.state.healedAt.includes(s.id);
    const label = state === 'done' ? `${s.title} — đã qua, huy hiệu ${s.badge}`
      : state === 'current' ? `${s.title} — ga hiện tại` : `${s.title} — chưa tới`;
    const inner = [
      h('span', { class: 'stop__media' }, porthole(s.image, String(i + 1))),
      h('span', { class: 'stop__text' },
        h('span', { class: 'stop__title' }, s.title),
        h('span', { class: 'stop__topic' }, state === 'locked' ? 'Chưa tới' : s.topic),
        state === 'done' && h('span', { class: 'stop__badge' }, '★ ', s.badge, healed ? ' · +1 ♥' : '')),
    ];
    return h('li', { class: `stop stop--${state}` },
      state === 'current'
        ? h('a', { class: 'stop__link', href: `#/station/${s.id}`, 'aria-label': label, 'aria-current': 'step' }, inner)
        : h('div', { class: 'stop__link', 'aria-label': label }, inner));
  });

  const bossState = atBoss ? 'current' : 'locked';
  const bossInner = [
    h('span', { class: 'stop__media' }, porthole(content.boss.image, '☠', 'porthole--boss')),
    h('span', { class: 'stop__text' },
      h('span', { class: 'stop__title' }, content.boss.title),
      h('span', { class: 'stop__topic' }, atBoss ? 'Boss đang chờ' : `Cần ${content.stations.length} huy hiệu`)),
  ];
  stops.push(h('li', { class: `stop stop--boss stop--${bossState}` },
    atBoss
      ? h('a', { class: 'stop__link', href: '#/boss', 'aria-current': 'step', 'aria-label': `${content.boss.title} — boss` }, bossInner)
      : h('div', { class: 'stop__link' }, bossInner)));

  const cur = atBoss ? null : game.currentStation(run);
  const next = atBoss
    ? h('section', { class: 'card next next--boss' },
        h('div', null,
          h('p', { class: 'eyebrow' }, 'Ga cuối'),
          h('h2', { class: 'next__title' }, content.boss.title),
          h('p', { class: 'muted' }, run.save.bossStartedAt
            ? 'Đồng hồ đang chạy — vào ngay!'
            : `${content.boss.questions.length} câu hỏi · giới hạn ${Math.round(game.bossRemainingMs(run.save) / 60000)} phút. Đồng hồ bắt đầu khi bạn bước vào.`)),
        h('a', { class: 'btn btn--danger', href: '#/boss' }, 'Đối mặt boss ▸'))
    : h('section', { class: 'card next' },
        h('div', null,
          h('p', { class: 'eyebrow' }, `Ga ${idx + 1}/${content.stations.length}`),
          h('h2', { class: 'next__title' }, cur!.title),
          h('p', { class: 'muted' }, cur!.topic)),
        h('a', { class: 'btn btn--primary', href: `#/station/${cur!.id}` }, 'Vào ga ▸'));

  const line = h('ol', { class: 'line', 'aria-label': 'Các ga trên tuyến (kéo ngang để xem)', tabindex: 0 }, stops);
  const prev = h('button', { class: 'line__nav line__nav--prev', type: 'button', 'aria-label': 'Xem các ga trước' }, '‹');
  const fwd = h('button', { class: 'line__nav line__nav--next', type: 'button', 'aria-label': 'Xem các ga sau' }, '›');
  const wrap = h('div', { class: 'line-wrap' }, prev, line, fwd);

  setAmbient(atBoss ? content.boss.image : game.currentStation(run).image);
  root.append(h('div', { class: 'map' },
    h('h1', { class: 'visually-hidden' }, 'Bản đồ tuyến tàu'),
    next,
    wrap,
    h('p', { class: 'line-hint muted' }, 'Kéo hoặc vuốt ngang để xem cả tuyến'),
  ));

  return horizontalScroller(line, wrap, prev, fwd);
};

/** Dải ngang: kéo bằng chuột, vuốt (native), lăn chuột, nút ‹ ›; mở ra thì canh giữa ga hiện tại. */
function horizontalScroller(line: HTMLElement, wrap: HTMLElement, prev: HTMLButtonElement, fwd: HTMLButtonElement) {
  const max = () => line.scrollWidth - line.clientWidth;

  const update = () => {
    const atStart = line.scrollLeft <= 1;
    const atEnd = line.scrollLeft >= max() - 1;
    prev.disabled = atStart;
    fwd.disabled = atEnd;
    wrap.classList.toggle('at-start', atStart);
    wrap.classList.toggle('at-end', atEnd);
  };

  const page = (dir: number) => line.scrollBy({ left: dir * line.clientWidth * 0.7, behavior: 'smooth' });
  prev.addEventListener('click', () => page(-1));
  fwd.addEventListener('click', () => page(1));

  // Kéo bằng chuột (cảm ứng đã cuộn sẵn). Chỉ coi là kéo khi di chuyển > 5px để không nuốt cú click vào ga.
  let startX = 0, startLeft = 0, pressed = false, dragged = false;
  line.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    pressed = true; dragged = false; startX = e.clientX; startLeft = line.scrollLeft;
  });
  line.addEventListener('pointermove', e => {
    if (!pressed) return;
    const dx = e.clientX - startX;
    if (!dragged && Math.abs(dx) > 5) {
      dragged = true;
      line.setPointerCapture(e.pointerId);
      line.classList.add('is-dragging');
    }
    if (dragged) line.scrollLeft = startLeft - dx;
  });
  const release = () => { pressed = false; line.classList.remove('is-dragging'); };
  line.addEventListener('pointerup', release);
  line.addEventListener('pointercancel', release);
  line.addEventListener('click', e => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
  line.addEventListener('dragstart', e => e.preventDefault());   // chặn kéo-thả ảnh/link mặc định

  // Lăn chuột dọc → cuộn ngang; tới mép thì trả lại cho trang cuộn bình thường
  line.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    if ((e.deltaY < 0 && line.scrollLeft <= 0) || (e.deltaY > 0 && line.scrollLeft >= max() - 1)) return;
    e.preventDefault();
    line.scrollLeft += e.deltaY;
  }, { passive: false });

  line.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);

  // Canh giữa ga hiện tại
  requestAnimationFrame(() => {
    const cur = line.querySelector<HTMLElement>('.stop--current');
    if (cur) line.scrollLeft = cur.offsetLeft + cur.offsetWidth / 2 - line.clientWidth / 2;
    update();
  });

  return () => window.removeEventListener('resize', update);
}
