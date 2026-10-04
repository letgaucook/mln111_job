import './styles/tokens.css';
import './styles/base.css';
import './styles/screens/home.css';
import './styles/screens/map.css';
import './styles/screens/quiz.css';
import './styles/screens/boss.css';
import './styles/screens/result.css';
import './styles/screens/leaderboard.css';
import './styles/screens/materials.css';

import { route, startRouter } from './router.ts';
import { home } from './screens/home.ts';
import { map } from './screens/map.ts';
import { quiz } from './screens/quiz.ts';
import { boss } from './screens/boss.ts';
import { result } from './screens/result.ts';
import { leaderboard } from './screens/leaderboard.ts';
import { guide } from './screens/pages.ts';
import { materials } from './screens/materials.ts';

route('/', home);                                   // route đầu tiên = mặc định khi không khớp
route('/map', map, { hud: true, title: 'Bản đồ' });
route('/station/:id', quiz, { hud: true, title: 'Ga' });
route('/boss', boss, { hud: true, title: 'Boss' });
route('/result', result, { title: 'Kết quả' });
route('/leaderboard', leaderboard, { title: 'Bảng xếp hạng' });
route('/guide', guide, { title: 'Hướng dẫn' });
route('/materials', materials, { title: 'Tài liệu' });
route('/materials/:page', materials, { title: 'Tài liệu' });

startRouter();
