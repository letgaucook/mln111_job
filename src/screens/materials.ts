// Tài liệu ôn tập dạng sách lật trang, khổ trang cố định vừa màn hình (không cuộn).
// Nội dung mỗi mục "## …" trong materials.md được tự chia thành nhiều trang bằng cách đo thực tế;
// chỉ ngắt giữa các ý (mục danh sách, đoạn, bảng), không cắt ngang dòng. Đổi kích thước → chia lại.
// Lật bằng nút ‹ ›, phím ← →, vuốt ngang, hoặc thanh tiến độ. Link theo mục: #/materials/<số ga>.
import materialsMd from '../../content/materials.md?raw';
import type { Screen } from '../router.ts';
import { h } from '../ui/dom.ts';
import { markdown } from '../ui/markdown.ts';

type Section = { chapter: string; title: string; html: string };
type Book = { title: string; sections: Section[] };
type Page = {
  section: number;          // 0 = mục lục, 1..n = mục
  part: number; parts: number;
  html: string;
};

/** Tách HTML đã render: # đầu tiên = tên sách, # tiếp theo = tên chương, ## = một mục */
function parse(md: string): Book {
  const tmp = document.createElement('div');
  tmp.innerHTML = markdown(md);   // markdown() đã escape HTML
  const book: Book = { title: '', sections: [] };
  let chapter = '';
  let sec: Section | null = null;
  for (const el of Array.from(tmp.children)) {
    if (el.tagName === 'H1') {
      if (!book.title) book.title = el.textContent ?? '';
      else chapter = el.textContent ?? '';
      sec = null;
    } else if (el.tagName === 'H2') {
      sec = { chapter, title: el.textContent ?? '', html: '' };
      book.sections.push(sec);
    } else if (sec) {
      sec.html += el.outerHTML;
    }
  }
  return book;
}

/**
 * Chia nội dung thành các khối nhỏ nhất được phép ngắt trang:
 * mỗi mục danh sách cấp 1 là một khối; mục có danh sách con thì tách nhãn và từng mục con thành khối riêng
 * (khối mục con giữ thụt lề và số thứ tự nhờ <ol start>).
 */
function blocksOf(html: string): string[] {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const out: string[] = [];
  for (const el of Array.from(tmp.children)) {
    if (el.tagName !== 'UL' && el.tagName !== 'OL') { out.push(el.outerHTML); continue; }
    const tag = el.tagName.toLowerCase();
    Array.from(el.children).forEach((li, i) => {
      const nested = Array.from(li.children).filter(c => c.tagName === 'UL' || c.tagName === 'OL');
      const start = tag === 'ol' ? ` start="${i + 1}"` : '';
      if (!nested.length) { out.push(`<${tag}${start}>${li.outerHTML}</${tag}>`); return; }
      const label = li.cloneNode(true) as HTMLElement;
      label.querySelectorAll(':scope > ul, :scope > ol').forEach(n => n.remove());
      out.push(`<${tag}${start}>${label.outerHTML}</${tag}>`);
      for (const list of nested) {
        const ntag = list.tagName.toLowerCase();
        Array.from(list.children).forEach((sub, j) => {
          const nstart = ntag === 'ol' ? ` start="${j + 1}"` : '';
          out.push(`<ul class="cont"><li><${ntag}${nstart}>${sub.outerHTML}</${ntag}></li></ul>`);
        });
      }
    });
  }
  return out;
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const materials: Screen = (root, [param]) => {
  const book = parse(materialsMd);
  let pages: Page[] = [];
  let index = 0;
  let busy = false;

  // Số trang nội dung (không tính các trang mục lục)
  const tocCount = () => pages.filter(p => p.section === 0).length;
  const pageNo = (i: number) => i - tocCount() + 1;
  const pageTotal = () => pages.length - tocCount();

  // ---------- Dựng một tờ ----------
  function head(page: Pick<Page, 'section' | 'part'>): HTMLElement {
    const cont = page.part > 1 ? ' (tiếp)' : '';
    if (page.section === 0) {
      return h('header', { class: 'leaf__head leaf__head--cover' },
        h('p', { class: 'eyebrow' }, 'Sổ tay hành khách'),
        h('h2', { class: 'leaf__booktitle' }, page.part > 1 ? 'Mục lục (tiếp)' : book.title));
    }
    const s = book.sections[page.section - 1];
    return h('header', { class: 'leaf__head' },
      h('p', { class: 'eyebrow' }, s.chapter),
      h('h2', { class: 'leaf__title' }, s.title + cont));
  }

  function leaf(i: number): HTMLElement {
    const p = pages[i];
    const body = h('div', { class: 'leaf__body prose' });
    body.innerHTML = p.html;
    // Mục lục: gắn hành động và số trang thật
    body.querySelectorAll<HTMLButtonElement>('[data-goto]').forEach(btn => {
      const sec = Number(btn.dataset.goto);
      const first = pages.findIndex(pg => pg.section === sec);
      btn.querySelector('.toc__page')!.textContent = String(pageNo(first));
      btn.addEventListener('click', () => go(first));
    });
    const s = p.section ? book.sections[p.section - 1] : null;
    const left = s ? `${s.title.split('·')[0].trim()}${p.parts > 1 ? ` · phần ${p.part}/${p.parts}` : ''}` : 'Mục lục';
    return h('article', { class: `leaf${p.section === 0 ? ' leaf--cover' : ''}`, 'aria-label': `Trang ${i}` },
      head(p), body,
      h('footer', { class: 'leaf__foot' }, h('span', null, left), h('span', null, p.section === 0 ? '' : `${pageNo(i)} / ${pageTotal()}`)));
  }

  // ---------- Chia trang bằng cách đo ----------
  function tocBlocks(): string[] {
    const byChapter = new Map<string, number[]>();
    book.sections.forEach((s, i) => {
      if (!byChapter.has(s.chapter)) byChapter.set(s.chapter, []);
      byChapter.get(s.chapter)!.push(i + 1);
    });
    const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    return Array.from(byChapter, ([name, secs]) =>
      `<section class="toc__chapter"><h3 class="toc__name">${esc(name)}</h3><ol class="toc__list">` +
      secs.map(n => `<li><button class="toc__item" type="button" data-goto="${n}"><span class="toc__title">${esc(book.sections[n - 1].title)}</span><span class="toc__page">00</span></button></li>`).join('') +
      '</ol></section>');
  }

  function paginate() {
    const probe = h('article', { class: 'leaf leaf--probe', 'aria-hidden': 'true' });
    const body = h('div', { class: 'leaf__body prose' });
    stage.appendChild(probe);
    const result: Page[] = [];

    const run = (section: number, blocks: string[]) => {
      const start = result.length;
      let part = 1, cur: string[] = [];
      const reset = () => {
        probe.replaceChildren(head({ section, part }), body, h('footer', { class: 'leaf__foot' }, h('span', null, '0'), h('span', null, '00 / 00')));
        body.replaceChildren();
        if (section === 0) probe.classList.add('leaf--cover'); else probe.classList.remove('leaf--cover');
      };
      const overflow = () => body.scrollHeight > body.clientHeight + 1;
      reset();
      for (const b of blocks) {
        body.insertAdjacentHTML('beforeend', b);
        if (overflow() && cur.length) {
          body.lastElementChild!.remove();
          result.push({ section, part, parts: 0, html: cur.join('') });
          part++; cur = [];
          reset();
          body.insertAdjacentHTML('beforeend', b);
        }
        cur.push(b);
      }
      result.push({ section, part, parts: 0, html: cur.join('') });
      for (let i = start; i < result.length; i++) result[i].parts = part;
    };

    run(0, tocBlocks());
    book.sections.forEach((s, i) => run(i + 1, blocksOf(s.html)));
    probe.remove();
    return result;
  }

  // ---------- Khung sách + điều hướng ----------
  const stage = h('div', { class: 'book__stage' });
  const prev = h('button', { class: 'btn btn--ghost book__btn', type: 'button', 'aria-label': 'Trang trước', onclick: () => go(index - 1) }, '‹', h('span', { class: 'book__btn-label' }, ' Trang trước'));
  const next = h('button', { class: 'btn btn--primary book__btn', type: 'button', 'aria-label': 'Trang sau', onclick: () => go(index + 1) }, h('span', { class: 'book__btn-label' }, 'Trang sau '), '›');
  const bar = h('div', { class: 'book__bar' });
  const counter = h('span', { class: 'book__counter', 'aria-live': 'polite' });
  const nav = h('nav', { class: 'book__nav', 'aria-label': 'Lật trang' },
    h('a', { class: 'book__home', href: '#/', 'aria-label': 'Về trang chủ', title: 'Trang chủ' }, '⌂'),
    prev,
    h('div', { class: 'book__progress' }, bar, counter),
    next);
  const wrap = h('div', { class: 'book' }, h('h1', { class: 'visually-hidden' }, 'Tài liệu ôn tập'), stage, nav);

  function buildBar() {
    bar.replaceChildren(...pages.map((p, i) => h('button', {
      class: `book__seg${p.section !== pages[i - 1]?.section ? ' book__seg--first' : ''}`, type: 'button',
      onclick: () => go(i),
      'aria-label': p.section === 0 ? `Mục lục${p.part > 1 ? ' (tiếp)' : ''}` : `Trang ${pageNo(i)}: ${book.sections[p.section - 1].title}`,
      title: p.section === 0 ? 'Mục lục' : book.sections[p.section - 1].title,
    })));
  }

  function syncNav() {
    prev.disabled = index === 0;
    next.disabled = index === pages.length - 1;
    Array.from(bar.children).forEach((seg, i) => {
      seg.classList.toggle('is-active', i === index);
      seg.classList.toggle('is-read', i < index);
      if (i === index) seg.setAttribute('aria-current', 'page'); else seg.removeAttribute('aria-current');
    });
    const p = pages[index];
    counter.textContent = p.section === 0 ? 'Mục lục' : `${book.sections[p.section - 1].title.split('·')[0].trim()} · trang ${pageNo(index)} / ${pageTotal()}`;
    // Cập nhật link theo mục mà không kích hoạt router (replaceState không bắn hashchange)
    history.replaceState(null, '', p.section === 0 ? '#/materials' : `#/materials/${p.section}`);
  }

  function settle(page: HTMLElement) {
    busy = false;
    syncNav();
    const title = page.querySelector<HTMLElement>('h2');
    if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
  }

  function go(to: number) {
    to = Math.min(pages.length - 1, Math.max(0, to));
    if (busy || to === index) return;
    const dir = to > index ? 1 : -1;
    const old = stage.querySelector<HTMLElement>('.leaf:not(.leaf--probe)');
    const page = leaf(to);
    index = to;

    if (reducedMotion() || !old) { old?.remove(); stage.appendChild(page); settle(page); return; }

    busy = true;
    const mover = dir > 0 ? old : page;   // tờ đang lật
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(fallback);
      mover.removeEventListener('animationend', onEnd);
      old.remove();
      page.classList.remove('leaf--top', 'leaf--turn-in');
      settle(page);
    };
    // Chỉ nhận sự kiện của chính tờ đó (bỏ qua hiệu ứng bóng ::after), và luôn có hẹn giờ dự phòng
    const onEnd = (e: AnimationEvent) => { if (e.target === mover && !e.pseudoElement) finish(); };
    const fallback = window.setTimeout(finish, 1000);
    mover.addEventListener('animationend', onEnd);

    if (dir > 0) {
      // Lật tới: trang mới nằm dưới, trang cũ lật sang trái
      old.classList.add('leaf--top', 'leaf--turn-out');
      stage.insertBefore(page, old);
    } else {
      // Lật lui: trang mới lật từ trái về, đè lên trang cũ
      page.classList.add('leaf--top', 'leaf--turn-in');
      stage.appendChild(page);
    }
  }

  /** Chia lại trang (lần đầu, khi font tải xong, khi đổi kích thước) và giữ vị trí đang đọc */
  function layout(keep?: { section: number; part: number }) {
    pages = paginate();
    buildBar();
    if (keep) {
      const same = pages.filter(p => p.section === keep.section);
      const target = same[Math.min(keep.part, same.length) - 1] ?? same[0];
      index = Math.max(0, pages.indexOf(target));
    }
    stage.querySelectorAll('.leaf:not(.leaf--probe)').forEach(n => n.remove());
    stage.appendChild(leaf(index));
    syncNav();
  }
  const position = () => ({ section: pages[index].section, part: pages[index].part });

  // Phím ← →
  function onKey(e: KeyboardEvent) {
    if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
  }
  document.addEventListener('keydown', onKey);

  // Vuốt ngang (cảm ứng / bút)
  let sx = 0, sy = 0, tracking = false;
  stage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    tracking = true; sx = e.clientX; sy = e.clientY;
  });
  stage.addEventListener('pointerup', e => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) go(index + (dx < 0 ? 1 : -1));
  });
  stage.addEventListener('pointercancel', () => { tracking = false; });

  // Khung sách đổi kích thước (xoay màn hình, đổi cửa sổ, thanh địa chỉ co giãn) → chia lại trang
  let timer = 0;
  let lastSize = '';
  const relayout = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (busy) return relayout();            // đang lật thì chờ lật xong
      const size = `${stage.clientWidth}x${stage.clientHeight}`;
      if (size === lastSize) return;
      lastSize = size;
      layout(position());
    }, 150);
  };
  const observer = new ResizeObserver(relayout);

  root.append(wrap);
  const wanted = Math.max(0, Math.min(book.sections.length, Number(param) || 0));
  layout({ section: wanted, part: 1 });
  lastSize = `${stage.clientWidth}x${stage.clientHeight}`;
  observer.observe(stage);
  // Dự phòng: một số trình duyệt không báo ResizeObserver trong mọi trường hợp
  window.addEventListener('resize', relayout);
  window.visualViewport?.addEventListener('resize', relayout);
  // Font web tải xong làm chữ đổi kích thước → đo lại cho chính xác
  document.fonts?.ready.then(() => { if (wrap.isConnected) { lastSize = ''; relayout(); } });

  return () => {
    document.removeEventListener('keydown', onKey);
    observer.disconnect();
    window.removeEventListener('resize', relayout);
    window.visualViewport?.removeEventListener('resize', relayout);
    clearTimeout(timer);
  };
};
