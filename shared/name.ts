// Quy tắc tên người chơi, dùng chung client & server
export const NAME_RE = /^[\p{L}\p{N}_ ]{2,20}$/u;
export const NAME_HINT = 'Tên 2–20 ký tự, chỉ gồm chữ, số, khoảng trắng, _';
export const cleanName = (name: unknown) => String(name ?? '').trim().replace(/\s+/g, ' ').normalize('NFC');
/** Khoá so sánh: "Phong" và " phong " là cùng một tên */
export const nameKey = (name: string) => cleanName(name).toLowerCase();
