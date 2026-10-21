import type { LangCode } from '@/lib/language-fonts';
import { getDashboardTranslation } from '@/lib/translations/dashboard';
import { getGamesTranslation } from '@/lib/translations/games';
import { getTravelDiaryTranslation } from '@/lib/translations/travel-diary';
import { getTravelTranslation } from '@/lib/translations/travel';
import type { DashboardWidgetKey } from '@/lib/widgets/types';

/** 쇼룸 카드와 관리자 비교 화면이 같은 위젯 이름을 쓴다. */
export function showroomWidgetLabels(lang: LangCode): Record<DashboardWidgetKey, string> {
  const dt = (key: Parameters<typeof getDashboardTranslation>[1]) => getDashboardTranslation(lang, key);
  const tt = (key: Parameters<typeof getTravelTranslation>[1]) => getTravelTranslation(lang, key);
  const gt = (key: Parameters<typeof getGamesTranslation>[1]) => getGamesTranslation(lang, key);
  const tdy = (key: Parameters<typeof getTravelDiaryTranslation>[1]) => getTravelDiaryTranslation(lang, key);
  return {
    tasks: dt('todo_section_title'),
    calendar: dt('section_title_calendar'),
    chat: dt('section_title_chat'),
    location: dt('section_title_location'),
    album: dt('section_title_memories'),
    travel: tt('title'),
    piggy: dt('piggy_section_admin_title'),
    games: gt('section_title'),
    travel_diary: tdy('section_title'),
    travel_quick_record: tt('quick_record_title'),
    family_log: 'Family Log',
  };
}
