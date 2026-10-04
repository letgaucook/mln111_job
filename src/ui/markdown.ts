// Markdown tối giản cho guide/materials: #..###, đoạn, danh sách (lồng 1 cấp), bảng |..|, >, **đậm**, *nghiêng*, `code`, [link](url)
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string) => s.replace(/[&<>"']/g, c => ESC[c]);

function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|#[^)\s]*)\)/g, '<a href="$2" rel="noopener">$1</a>');
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

export function markdown(src: string): string {
  const out: string[] = [];
  const lists: { kind: 'ul' | 'ol'; indent: number }[] = [];   // ngăn xếp danh sách đang mở
  let para: string[] = [];
  let table: string[][] = [];

  const endPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const closeList = () => { const l = lists.pop()!; out.push(`</li></${l.kind}>`); };
  const endLists = () => { while (lists.length) closeList(); };
  const endTable = () => {
    if (!table.length) return;
    const [head, ...body] = table;
    out.push('<div class="table-wrap"><table><thead><tr>' + head.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'
      + body.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
    table = [];
  };
  const endAll = () => { endPara(); endLists(); endTable(); };

  for (const raw of src.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    let m: RegExpMatchArray | null;
    if (!line.trim()) { endAll(); continue; }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      endPara(); endLists();
      if (!/^\s*\|[\s:|-]+\|\s*$/.test(line)) table.push(cells(line));   // bỏ dòng phân cách |---|
      continue;
    }
    endTable();

    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      endAll();
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
      continue;
    }
    if ((m = line.match(/^>\s?(.*)$/))) { endAll(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }

    if ((m = line.match(/^(\s*)(?:([-*])|\d+\.)\s+(.*)$/))) {
      endPara();
      const indent = m[1].length;
      const kind = m[2] ? 'ul' : 'ol';
      while (lists.length && indent < lists[lists.length - 1].indent) closeList();
      const top = lists[lists.length - 1];
      if (!top || indent > top.indent) {
        out.push(`<${kind}><li>`);                      // mở danh sách mới (hoặc lồng vào mục trước)
        lists.push({ kind, indent });
      } else if (top.kind !== kind) {
        closeList();
        out.push(`<${kind}><li>`);
        lists.push({ kind, indent });
      } else {
        out.push('</li><li>');
      }
      out.push(inline(m[3]));
      continue;
    }

    if (lists.length && /^\s+/.test(raw)) { out.push(' ' + inline(line.trim())); continue; }  // dòng nối của mục
    endLists();
    para.push(line.trim());
  }
  endAll();
  return out.join('\n');
}
