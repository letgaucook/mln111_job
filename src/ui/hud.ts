// HUD: thanh mảnh trên cùng — tim · tri thức · huy hiệu · ga hiện tại. Chỉ hiện khi đang trong run.
import { CONFIG } from '../../shared/rules.ts';
import { content } from '../content.ts';
import * as game from '../game.ts';
import { h, hearts, mount } from './dom.ts';

const el = () => document.getElementById('hud')!;

function where(run: game.Run): string {
  if (game.atBoss(run)) return content.boss.title;
  return game.currentStation(run)?.title ?? '';
}

export const hud = {
  toggle(show: boolean) {
    el().hidden = !show;
    if (show) this.update(game.current());
  },

  update(run: game.Run | null) {
    if (!run) { el().hidden = true; return; }
    const s = run.state;
    mount(el(),
      h('a', { class: 'hud__home', href: '#/', 'aria-label': 'Về trang chủ' }, '⌂'),
      h('div', { class: 'hud__item' }, hearts(s.hearts, CONFIG.maxHearts)),
      h('div', { class: 'hud__item', title: 'Tri thức' },
        h('span', { class: 'hud__label' }, 'Tri thức'), h('strong', null, s.knowledge)),
      h('div', { class: 'hud__item', title: 'Huy hiệu' },
        h('span', { class: 'hud__label' }, 'Huy hiệu'), h('strong', null, `${s.badges}/${content.stations.length}`)),
      h('a', { class: 'hud__item hud__where', href: '#/map' }, h('span', { class: 'hud__label' }, 'Ga'), h('strong', null, where(run))),
    );
  },

  /** Hiệu ứng mất tim */
  hit() {
    const e = el();
    e.classList.remove('hud--hit');
    void e.offsetWidth;
    e.classList.add('hud--hit');
  },
};
