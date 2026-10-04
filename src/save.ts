// Lưu tiến độ vào localStorage. Máu/điểm/trạm không lưu — luôn tính lại bằng replay().
const KEY = 'survival-save-v1';
const PLAYER_KEY = 'survival-player';           // tồn tại lâu dài, không xoá khi thua
const NAME_KEY = 'survival-name';               // tên đã dùng gần nhất (điền sẵn ở Home, đánh dấu bảng xếp hạng)

export type Save = {
  name: string;
  contentVersion: number;
  seed: string;                                  // crypto.randomUUID() khi bắt đầu run
  answers: { qid: string; chosen: number }[];   // nguồn sự thật duy nhất
  bossStartedAt?: number;                        // để tính đồng hồ boss khi reload
  pending?: { qid: string; order: number[] };    // câu đang hiển thị + thứ tự đáp án đã xáo
  submitted?: boolean;                           // đã nộp điểm thành công
};

export const load = (): Save | null => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
};
export const save = (s: Save) => localStorage.setItem(KEY, JSON.stringify(s));
export const clear = () => localStorage.removeItem(KEY);

/** Mã bí mật của thiết bị này, dùng để giữ tên trên bảng xếp hạng */
export function playerToken(): string {
  let t = localStorage.getItem(PLAYER_KEY);
  if (!t) { t = crypto.randomUUID(); localStorage.setItem(PLAYER_KEY, t); }
  return t;
}

export const lastName = () => localStorage.getItem(NAME_KEY) ?? '';
export const rememberName = (n: string) => localStorage.setItem(NAME_KEY, n);
