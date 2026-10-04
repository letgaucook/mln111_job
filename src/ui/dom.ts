// Helper DOM nhỏ: tạo phần tử an toàn (không innerHTML với dữ liệu người dùng)
type Child = Node | string | number | false | null | undefined;
type Attrs = Record<string, string | number | boolean | EventListener | undefined | null>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Attrs | null = null, ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

function append(el: Node, children: (Child | Child[])[]) {
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Phần tử SVG từ markup tĩnh (không chứa dữ liệu người dùng) */
export function svg(markup: string): Element {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild!;
}

export function mount(root: HTMLElement, ...children: (Child | Child[])[]) {
  root.replaceChildren();
  append(root, children);
}

let toastHost: HTMLElement | null = null;
export function toast(text: string, kind: 'info' | 'good' | 'bad' = 'info', ms = 2600) {
  toastHost ??= document.getElementById('toasts');
  if (!toastHost) return;
  const el = h('div', { class: `toast toast--${kind}`, role: 'status' }, text);
  toastHost.appendChild(el);
  setTimeout(() => {
    el.classList.add('toast--out');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

/** Ảnh nền mờ theo màn (ảnh ga / boss). Gọi không tham số để tắt. */
let ambientWanted: string | undefined;
export function setAmbient(image?: string) {
  const el = document.getElementById('ambient');
  ambientWanted = image;
  if (!el) return;
  if (!image) { el.classList.remove('is-on'); return; }
  const url = `/images/${image}`;
  const img = new Image();
  img.onload = () => {
    if (ambientWanted !== image) return;   // đã chuyển màn trong lúc tải
    el.style.backgroundImage = `url("${url}")`;
    el.classList.add('is-on');
  };
  img.src = url;   // chỉ bật khi ảnh tải được — thiếu ảnh thì giữ nền chung
}

/** Khung ảnh tròn kiểu cửa sổ tàu; ảnh lỗi/thiếu thì hiện nhãn (số ga) */
export function porthole(src: string | undefined, label: string, cls = '') {
  const frame = h('div', { class: `porthole ${cls}`, 'aria-hidden': 'true' },
    h('span', { class: 'porthole__label' }, label));
  if (src) {
    const img = h('img', { src: `/images/${src}`, alt: '', loading: 'lazy', decoding: 'async' });
    img.addEventListener('error', () => img.remove());
    img.addEventListener('load', () => frame.classList.add('porthole--img'));
    frame.appendChild(img);
  }
  return frame;
}

export const hearts = (n: number, max: number) =>
  h('span', { class: 'hearts', 'aria-label': `${n} trên ${max} tim` },
    Array.from({ length: max }, (_, i) => h('span', { class: i < n ? 'heart' : 'heart heart--empty' }, '♥')));
