// Màn phụ: Hướng dẫn (markdown tĩnh). Tài liệu ôn tập dạng sách lật trang nằm ở materials.ts
import guideMd from '../../content/guide.md?raw';
import type { Screen } from '../router.ts';
import { h } from '../ui/dom.ts';
import { markdown } from '../ui/markdown.ts';

const page = (md: string): Screen => root => {
  const prose = h('article', { class: 'prose card' });
  prose.innerHTML = markdown(md);   // markdown() đã escape HTML
  root.append(h('div', { class: 'page' }, prose,
    h('nav', { class: 'result__links' }, h('a', { class: 'btn btn--ghost', href: '#/' }, '← Trang chủ'))));
};

export const guide = page(guideMd);
