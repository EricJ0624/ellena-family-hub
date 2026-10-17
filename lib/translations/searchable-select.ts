import type { LangCode } from '@/lib/language-fonts';

type SearchableSelectText = {
  search: string;
  empty: string;
};

const TEXT: Record<LangCode, SearchableSelectText> = {
  ko: { search: '검색', empty: '일치하는 항목이 없습니다.' },
  en: { search: 'Search', empty: 'No matches.' },
  ja: { search: '検索', empty: '一致する項目がありません。' },
  'zh-CN': { search: '搜索', empty: '没有匹配项。' },
  'zh-TW': { search: '搜尋', empty: '沒有相符項目。' },
  es: { search: 'Buscar', empty: 'No hay coincidencias.' },
  fr: { search: 'Rechercher', empty: 'Aucun résultat.' },
  de: { search: 'Suchen', empty: 'Keine Treffer.' },
  it: { search: 'Cerca', empty: 'Nessun risultato.' },
  pt: { search: 'Pesquisar', empty: 'Nenhum resultado.' },
};

export function getSearchableSelectText(lang: LangCode, key: keyof SearchableSelectText): string {
  return (TEXT[lang] ?? TEXT.en)[key];
}
