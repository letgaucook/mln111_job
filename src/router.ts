// Hash router tự viết: #/station/3 → screen station với params ['3']
import { hud } from './ui/hud.ts';
import { setAmbient } from './ui/dom.ts';

export type Cleanup = () => void;
export type Screen = (root: HTMLElement, params: string[]) => Cleanup | void;
type Route = { pattern: RegExp; screen: Screen; hud?: boolean; title?: string };

const routes: Route[] = [];
let cleanup: Cleanup | void;

export function route(path: string, screen: Screen, opts: { hud?: boolean; title?: string } = {}) {
  // '/station/:id' → ^/station/([^/]+)$
  const pattern = new RegExp('^' + path.replace(/:[a-z]+/gi, '([^/]+)') + '$');
  routes.push({ pattern, screen, ...opts });
}

export const go = (path: string) => {
  if (location.hash === '#' + path) render();
  else location.hash = path;
};
export const replaceRoute = (path: string) => {
  history.replaceState(null, '', '#' + path);
  render();
};

const BASE_TITLE = 'Chuyến Tàu Tri Thức';

function render() {
  const path = location.hash.replace(/^#/, '') || '/';
  const root = document.getElementById('app')!;
  let match: RegExpMatchArray | null = null;
  const r = routes.find(x => (match = path.match(x.pattern))) ?? routes[0];
  if (cleanup) cleanup();
  cleanup = undefined;
  root.replaceChildren();
  window.scrollTo(0, 0);
  hud.toggle(!!r.hud);
  setAmbient();
  document.body.dataset.screen = path.split('/')[1] || 'home';
  document.title = r.title ? `${r.title} · ${BASE_TITLE}` : BASE_TITLE;
  cleanup = r.screen(root, match ? (match as RegExpMatchArray).slice(1) : []);
  // Đưa focus về nội dung chính cho người dùng bàn phím / trình đọc màn hình
  const heading = root.querySelector<HTMLElement>('h1, h2');
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  render();
}
