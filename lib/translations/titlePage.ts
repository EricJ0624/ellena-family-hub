import type { LangCode } from '@/lib/language-fonts';

export type TitlePageTranslations = {
  frame_change: string;
  photo_refresh: string;
  title_placeholder: string;
};

const titlePage: Record<LangCode, TitlePageTranslations> = {
  ko: {
    frame_change: '프레임 변경',
    photo_refresh: '사진 새로고침',
    title_placeholder: '타이틀 텍스트를 입력하세요',
  },
  en: {
    frame_change: 'Change frame',
    photo_refresh: 'Refresh photo',
    title_placeholder: 'Enter title text',
  },
  ja: {
    frame_change: 'フレーム変更',
    photo_refresh: '写真を更新',
    title_placeholder: 'タイトルを入力',
  },
  'zh-CN': {
    frame_change: '更换相框',
    photo_refresh: '刷新照片',
    title_placeholder: '输入标题文字',
  },
  'zh-TW': {
    frame_change: '更換相框',
    photo_refresh: '重新整理照片',
    title_placeholder: '輸入標題文字',
  },
};

export function getTitlePageTranslation(lang: LangCode, key: keyof TitlePageTranslations): string {
  return titlePage[lang]?.[key] ?? titlePage.en[key] ?? (titlePage.ko[key] as string) ?? key;
}
