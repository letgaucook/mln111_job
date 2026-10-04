// api/leaderboard.ts — Vercel Function: bảng xếp hạng chung (Upstash Redis)
//   GET                          → top 10
//   POST { action: 'claim' }     → giữ tên cho thiết bị (token)
//   POST { action: 'submit' }    → chấm lại bằng replay() rồi ghi điểm
import { Redis } from '@upstash/redis';
import content from '../content/stations.json' with { type: 'json' };
import { replay, finalScore, RuleError, type Content, type RunState } from '../shared/rules.js';
import { NAME_RE, NAME_HINT, cleanName, nameKey as keyOf } from '../shared/name.js';

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const Z = 'lb:z';         // sorted set: member = key tên, score = score*1000 + hearts
const META = 'lb:meta';   // hash: key tên → { name, score, hearts, knowledge, at }
const OWNER = 'lb:owner'; // hash: key tên → 'h:' + sha256(token)

type Row = { name: string; score: number; hearts: number; knowledge: number; at: number };

// Tiền tố 'h:' để @upstash/redis không tự JSON.parse chuỗi hex thành số
const sha256 = async (s: string) => 'h:' + Buffer.from(
  await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))).toString('hex');
const bad = (msg: string, status = 400) => Response.json({ error: msg }, { status });
const noRedis = () => bad('Máy chủ chưa cấu hình Redis', 503);

async function ownName(db: Redis, name: string, tok: string): Promise<boolean> {
  const h = await sha256(tok);
  await db.hsetnx(OWNER, keyOf(name), h);                 // giữ tên nếu còn trống
  return (await db.hget<string>(OWNER, keyOf(name))) === h;
}

export async function GET() {
  if (!redis) return noRedis();
  const flat = await redis.zrange<(string | number)[]>(Z, 0, 19, { rev: true, withScores: true });
  // member có thể bị tự deserialize (vd. tên "123" → số) nên ép lại về chuỗi
  const keys = flat.filter((_, i) => i % 2 === 0).map(String);
  if (!keys.length) return Response.json([]);
  const metas = await redis.hmget<Record<string, Row>>(META, ...keys);
  const rows = keys.map(k => metas?.[k]).filter((r): r is Row => !!r)
    .sort((a, b) => b.score - a.score || b.hearts - a.hearts || a.at - b.at)
    .slice(0, 10);
  return Response.json(rows, { headers: { 'Cache-Control': 's-maxage=10' } });
}

export async function POST(req: Request) {
  if (!redis) return noRedis();
  const body = await req.json().catch(() => null);
  const { action, name, token: tok, seed, answers } = body ?? {};
  const clean = cleanName(name);
  if (!NAME_RE.test(clean)) return bad(NAME_HINT);
  if (typeof tok !== 'string' || tok.length < 16 || tok.length > 128) return bad('Thiếu mã người chơi');
  if (action !== 'claim' && action !== 'submit') return bad('action không hợp lệ');

  if (!(await ownName(redis, clean, tok))) return bad('Tên đã có người dùng, vui lòng chọn tên khác', 409);
  if (action === 'claim') return Response.json({ ok: true });

  if (typeof seed !== 'string' || !seed || seed.length > 64) return bad('seed không hợp lệ');
  let state: RunState;
  try { state = replay(content as Content, seed, answers); }
  catch (e) { return bad(e instanceof RuleError ? e.message : 'Dữ liệu không hợp lệ'); }
  if (state.status !== 'won') return bad('Chưa thắng boss');

  const score = finalScore(state);
  const rank = score * 1000 + state.hearts;
  const key = keyOf(clean);
  const old = await redis.zscore(Z, key);
  if (old !== null && Number(old) >= rank) return Response.json({ updated: false, score });

  await redis.zadd(Z, { score: rank, member: key });
  await redis.hset<Row>(META, { [key]: {
    name: clean, score, hearts: state.hearts, knowledge: state.knowledge, at: Date.now(),
  } });
  return Response.json({ updated: true, score });
}
