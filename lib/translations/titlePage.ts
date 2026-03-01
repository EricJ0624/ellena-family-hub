import type { LangCode } from '@/lib/language-fonts';

export type TitlePageTranslations = {
  frame_change: string;
  photo_refresh: string;
  title_placeholder: string;
  photo_alt_today_memory: string;
  frame_style_select: string;
  frame_baroque: string;
  frame_ornate: string;
  frame_vintage: string;
  frame_modern: string;
  frame_minimal: string;
  frame_baroque_desc: string;
  frame_ornate_desc: string;
  frame_vintage_desc: string;
  frame_modern_desc: string;
  frame_minimal_desc: string;
  font_inter: string;
  font_roboto: string;
  font_poppins: string;
  font_montserrat: string;
  font_playfair_display: string;
  font_merriweather: string;
  font_lora: string;
  font_dancing_script: string;
  font_pacifico: string;
  font_arial: string;
  font_georgia: string;
  font_times_new_roman: string;
  design_edit_title: string;
  design_edit_subtitle: string;
  content_label: string;
  font_weight_label: string;
  letter_spacing_label: string;
  font_weight_300: string;
  font_weight_400: string;
  font_weight_500: string;
  font_weight_600: string;
  font_weight_700: string;
  font_weight_800: string;
  font_weight_900: string;
};

const titlePage: Record<LangCode, TitlePageTranslations> = {
  ko: {
    frame_change: '프레임 변경',
    photo_refresh: '사진 새로고침',
    title_placeholder: '타이틀 텍스트를 입력하세요',
    photo_alt_today_memory: '오늘의 추억',
    frame_style_select: '프레임 스타일 선택',
    frame_baroque: '바로크',
    frame_ornate: '오네이트',
    frame_vintage: '빈티지',
    frame_modern: '모던',
    frame_minimal: '미니멀',
    frame_baroque_desc: '화려하고 장식적인 클래식 프레임',
    frame_ornate_desc: '정교한 조각 패턴의 고급 프레임',
    frame_vintage_desc: '우아한 빈티지 스타일 프레임',
    frame_modern_desc: '깔끔하고 현대적인 프레임',
    frame_minimal_desc: '심플하고 세련된 프레임',
    font_inter: 'Inter (모던)',
    font_roboto: 'Roboto (깔끔)',
    font_poppins: 'Poppins (세련)',
    font_montserrat: 'Montserrat (강렬)',
    font_playfair_display: 'Playfair Display (우아)',
    font_merriweather: 'Merriweather (전통)',
    font_lora: 'Lora (읽기 좋음)',
    font_dancing_script: 'Dancing Script (손글씨)',
    font_pacifico: 'Pacifico (캐주얼)',
    font_arial: 'Arial (기본)',
    font_georgia: 'Georgia (클래식)',
    font_times_new_roman: 'Times New Roman (전통)',
    design_edit_title: '디자인 수정',
    design_edit_subtitle: '타이틀 스타일을 자유롭게 변경하세요',
    content_label: '글자 내용',
    font_weight_label: '폰트 두께',
    letter_spacing_label: '자간',
    font_weight_300: 'Light (300)',
    font_weight_400: 'Normal (400)',
    font_weight_500: 'Medium (500)',
    font_weight_600: 'Semi Bold (600)',
    font_weight_700: 'Bold (700)',
    font_weight_800: 'Extra Bold (800)',
    font_weight_900: 'Black (900)',
  },
  en: {
    frame_change: 'Change frame',
    photo_refresh: 'Refresh photo',
    title_placeholder: 'Enter title text',
    photo_alt_today_memory: "Today's memory",
    frame_style_select: 'Select frame style',
    frame_baroque: 'Baroque',
    frame_ornate: 'Ornate',
    frame_vintage: 'Vintage',
    frame_modern: 'Modern',
    frame_minimal: 'Minimal',
    frame_baroque_desc: 'Ornate classic frame',
    frame_ornate_desc: 'Intricate carved pattern frame',
    frame_vintage_desc: 'Elegant vintage-style frame',
    frame_modern_desc: 'Clean, modern frame',
    frame_minimal_desc: 'Simple, refined frame',
    font_inter: 'Inter (Modern)',
    font_roboto: 'Roboto (Clean)',
    font_poppins: 'Poppins (Refined)',
    font_montserrat: 'Montserrat (Bold)',
    font_playfair_display: 'Playfair Display (Elegant)',
    font_merriweather: 'Merriweather (Traditional)',
    font_lora: 'Lora (Readable)',
    font_dancing_script: 'Dancing Script (Handwritten)',
    font_pacifico: 'Pacifico (Casual)',
    font_arial: 'Arial (Default)',
    font_georgia: 'Georgia (Classic)',
    font_times_new_roman: 'Times New Roman (Traditional)',
    design_edit_title: 'Edit design',
    design_edit_subtitle: 'Customize the title style',
    content_label: 'Text content',
    font_weight_label: 'Font weight',
    letter_spacing_label: 'Letter spacing',
    font_weight_300: 'Light (300)',
    font_weight_400: 'Normal (400)',
    font_weight_500: 'Medium (500)',
    font_weight_600: 'Semi Bold (600)',
    font_weight_700: 'Bold (700)',
    font_weight_800: 'Extra Bold (800)',
    font_weight_900: 'Black (900)',
  },
  ja: {
    frame_change: 'フレーム変更',
    photo_refresh: '写真を更新',
    title_placeholder: 'タイトルを入力',
    photo_alt_today_memory: '今日の思い出',
    frame_style_select: 'フレームスタイルを選択',
    frame_baroque: 'バロック',
    frame_ornate: 'オーネート',
    frame_vintage: 'ヴィンテージ',
    frame_modern: 'モダン',
    frame_minimal: 'ミニマル',
    frame_baroque_desc: '華やかなクラシックフレーム',
    frame_ornate_desc: '精巧な彫刻パターンの高級フレーム',
    frame_vintage_desc: 'エレガントなヴィンテージスタイル',
    frame_modern_desc: 'シンプルでモダンなフレーム',
    frame_minimal_desc: 'シンプルで上品なフレーム',
    font_inter: 'Inter (モダン)',
    font_roboto: 'Roboto (クリーン)',
    font_poppins: 'Poppins (上品)',
    font_montserrat: 'Montserrat (力強い)',
    font_playfair_display: 'Playfair Display (エレガント)',
    font_merriweather: 'Merriweather (伝統)',
    font_lora: 'Lora (読みやすい)',
    font_dancing_script: 'Dancing Script (手書き)',
    font_pacifico: 'Pacifico (カジュアル)',
    font_arial: 'Arial (標準)',
    font_georgia: 'Georgia (クラシック)',
    font_times_new_roman: 'Times New Roman (伝統)',
    design_edit_title: 'デザイン編集',
    design_edit_subtitle: 'タイトルスタイルを自由に変更できます',
    content_label: '文字内容',
    font_weight_label: 'フォントの太さ',
    letter_spacing_label: '字間',
    font_weight_300: 'Light (300)',
    font_weight_400: 'Normal (400)',
    font_weight_500: 'Medium (500)',
    font_weight_600: 'Semi Bold (600)',
    font_weight_700: 'Bold (700)',
    font_weight_800: 'Extra Bold (800)',
    font_weight_900: 'Black (900)',
  },
  'zh-CN': {
    frame_change: '更换相框',
    photo_refresh: '刷新照片',
    title_placeholder: '输入标题文字',
    photo_alt_today_memory: '今日回忆',
    frame_style_select: '选择相框样式',
    frame_baroque: '巴洛克',
    frame_ornate: '华丽',
    frame_vintage: '复古',
    frame_modern: '现代',
    frame_minimal: '极简',
    frame_baroque_desc: '华丽装饰经典相框',
    frame_ornate_desc: '精美雕刻图案高级相框',
    frame_vintage_desc: '优雅复古风格相框',
    frame_modern_desc: '简洁现代相框',
    frame_minimal_desc: '简约精致相框',
    font_inter: 'Inter (现代)',
    font_roboto: 'Roboto (简洁)',
    font_poppins: 'Poppins (精致)',
    font_montserrat: 'Montserrat (醒目)',
    font_playfair_display: 'Playfair Display (优雅)',
    font_merriweather: 'Merriweather (传统)',
    font_lora: 'Lora (易读)',
    font_dancing_script: 'Dancing Script (手写)',
    font_pacifico: 'Pacifico (随意)',
    font_arial: 'Arial (默认)',
    font_georgia: 'Georgia (经典)',
    font_times_new_roman: 'Times New Roman (传统)',
    design_edit_title: '编辑设计',
    design_edit_subtitle: '自由更改标题样式',
    content_label: '文字内容',
    font_weight_label: '字重',
    letter_spacing_label: '字间距',
    font_weight_300: '细体 (300)',
    font_weight_400: '常规 (400)',
    font_weight_500: '中等 (500)',
    font_weight_600: '半粗 (600)',
    font_weight_700: '粗体 (700)',
    font_weight_800: '特粗 (800)',
    font_weight_900: '黑体 (900)',
  },
  'zh-TW': {
    frame_change: '更換相框',
    photo_refresh: '重新整理照片',
    title_placeholder: '輸入標題文字',
    photo_alt_today_memory: '今日回憶',
    frame_style_select: '選擇相框樣式',
    frame_baroque: '巴洛克',
    frame_ornate: '華麗',
    frame_vintage: '復古',
    frame_modern: '現代',
    frame_minimal: '極簡',
    frame_baroque_desc: '華麗裝飾經典相框',
    frame_ornate_desc: '精美雕刻圖案高級相框',
    frame_vintage_desc: '優雅復古風格相框',
    frame_modern_desc: '簡潔現代相框',
    frame_minimal_desc: '簡約精緻相框',
    font_inter: 'Inter (現代)',
    font_roboto: 'Roboto (簡潔)',
    font_poppins: 'Poppins (精緻)',
    font_montserrat: 'Montserrat (醒目)',
    font_playfair_display: 'Playfair Display (優雅)',
    font_merriweather: 'Merriweather (傳統)',
    font_lora: 'Lora (易讀)',
    font_dancing_script: 'Dancing Script (手寫)',
    font_pacifico: 'Pacifico (隨意)',
    font_arial: 'Arial (預設)',
    font_georgia: 'Georgia (經典)',
    font_times_new_roman: 'Times New Roman (傳統)',
    design_edit_title: '編輯設計',
    design_edit_subtitle: '自由變更標題樣式',
    content_label: '文字內容',
    font_weight_label: '字重',
    letter_spacing_label: '字間距',
    font_weight_300: '細體 (300)',
    font_weight_400: '常規 (400)',
    font_weight_500: '中等 (500)',
    font_weight_600: '半粗 (600)',
    font_weight_700: '粗體 (700)',
    font_weight_800: '特粗 (800)',
    font_weight_900: '黑體 (900)',
  },
};

export function getTitlePageTranslation(lang: LangCode, key: keyof TitlePageTranslations): string {
  return titlePage[lang]?.[key] ?? titlePage.en[key] ?? (titlePage.ko[key] as string) ?? key;
}
