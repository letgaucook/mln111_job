// Gọi Vercel Function /api/leaderboard
import { playerToken } from './save.ts';

export type LeaderRow = { name: string; score: number; hearts: number; knowledge: number; at: number };

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function call<T>(init?: RequestInit): Promise<T> {
  let res: Response;
  let data: any;
  try {
    // Giới hạn 10s để mạng treo không làm UI kẹt ở trạng thái "Đang…"
    res = await fetch('/api/leaderboard', { ...init, signal: AbortSignal.timeout(10_000) });
    data = await res.json().catch(() => null);
  } catch (e) {
    const timeout = e instanceof DOMException && e.name === 'TimeoutError';
    throw new ApiError(timeout ? 'Máy chủ phản hồi quá lâu' : 'Không kết nối được máy chủ', 0);
  }
  if (!res.ok || data === null) {
    throw new ApiError(data?.error ?? (res.status === 404 ? 'Không kết nối được máy chủ' : `Máy chủ lỗi (${res.status})`), res.status);
  }
  return data as T;
}

const post = <T>(body: object) => call<T>({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...body, token: playerToken() }),
});

export const fetchLeaderboard = () => call<LeaderRow[]>();
export const claimName = (name: string) => post<{ ok: true }>({ action: 'claim', name });
export const submitRun = (name: string, seed: string, answers: { qid: string; chosen: number }[]) =>
  post<{ updated: boolean; score: number }>({ action: 'submit', name, seed, answers });
