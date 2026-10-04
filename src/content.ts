// Nội dung câu hỏi: bundle tĩnh cùng app
import raw from '../content/stations.json';
import type { Content, Question } from '../shared/rules.ts';

export type StationInfo = {
  id: number; title: string; topic: string; story: string; badge: string; image?: string;
  questions: Question[];
};
export type GameContent = Omit<Content, 'stations' | 'boss'> & {
  stations: StationInfo[];
  boss: Content['boss'] & { title: string; story?: string; image?: string };
};

export const content = raw as GameContent;
export const BOSS_TIME_LIMIT_SEC = content.boss.timeLimitSec || 300;

export function findQuestion(qid: string): Question | undefined {
  for (const s of content.stations) {
    const q = s.questions.find(x => x.id === qid);
    if (q) return q;
  }
  return content.boss.questions.find(x => x.id === qid);
}
