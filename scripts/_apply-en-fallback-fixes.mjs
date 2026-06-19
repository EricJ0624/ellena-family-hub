import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** file -> lang -> key -> newValue */
const FIXES = {
  'dashboard.ts': {
    ja: {
      todo_section_title: 'ファミリータスク',
      location_modal_id_prefix: 'ID：',
    },
    'zh-CN': { todo_section_title: '家庭任务' },
    'zh-TW': { todo_section_title: '家庭任務' },
    es: {
      photo_download_original: 'Foto original',
      memories_mode_original: 'Original',
    },
    fr: {
      photo_download_original: 'Photo originale',
      memories_mode_original: 'Original',
    },
    de: {
      photo_download_original: 'Originalfoto',
      memories_mode_original: 'Original',
      location_modal_online: '● Online',
    },
    it: { location_modal_id_prefix: 'ID:' },
  },
  'piggy.ts': {
    ja: { management_title: '貯金箱管理' },
    'zh-CN': { management_title: '存钱罐管理' },
    'zh-TW': { management_title: '存錢筒管理' },
  },
  'games.ts': {
    it: {
      ladder_reset: 'Reimposta',
      rps_reset: 'Reimposta',
      roulette_reset: 'Reimposta',
    },
  },
  'memberManagement.ts': {
    es: { role: 'Rol' },
  },
  'admin.ts': {
    es: { role: 'Rol' },
    ja: {
      confirm_delete_piggy_archive: 'このアーカイブを削除しますか？削除した取引記録は復元できません。',
      error_piggy_archive_fetch: 'アーカイブの取得に失敗しました。',
      error_piggy_archive_list: '貯金箱アーカイブの読み込みに失敗しました。',
      error_piggy_archive_detail: '詳細の読み込みに失敗しました。',
      error_piggy_archive_delete: '削除に失敗しました。',
      error_piggy_archive_delete_msg: 'アーカイブの削除に失敗しました。',
      piggy_archive_section_title: '貯金箱アーカイブ（削除された貯金箱取引）',
      piggy_archive_deleted_at: '削除日時',
      piggy_archive_account_name: '口座名',
      piggy_archive_deleted_by: '削除した管理者',
      no_piggy_archives: '貯金箱アーカイブはありません。',
      archive_delete_btn: '削除',
      no_transactions: '取引がありません。',
      no_groups: 'グループがありません。',
      select_group_option: 'グループを選択',
      no_photos: '写真がありません。',
      users_empty_hint: 'ファミリーグループを作成するか、招待コードで参加できます。',
      announcement_title_content_required: '少なくとも1言語でタイトルと内容を入力してください。',
      answer_required: '回答を入力してください。',
      answer_save_failed: '回答の保存に失敗しました。',
      answer_saved: '回答を保存しました。',
      answer_save_error: '回答の保存に失敗しました。',
      answer_content_required: '回答内容を入力してください。',
      select_group_label: '管理するグループを選択',
      piggy_archive_transactions_title: 'アーカイブされた取引',
      view_transactions_btn: '取引を見る',
    },
    'zh-CN': {
      confirm_delete_piggy_archive: '确定删除此归档吗？已删除的交易记录无法恢复。',
      error_piggy_archive_fetch: '获取归档失败。',
      error_piggy_archive_list: '加载存钱罐归档失败。',
      error_piggy_archive_detail: '加载详情失败。',
      error_piggy_archive_delete: '删除失败。',
      error_piggy_archive_delete_msg: '删除归档失败。',
      piggy_archive_section_title: '存钱罐归档（已删除的存钱罐交易）',
      piggy_archive_deleted_at: '删除时间',
      piggy_archive_account_name: '账户名称',
      piggy_archive_deleted_by: '删除者',
      no_piggy_archives: '暂无存钱罐归档。',
      archive_delete_btn: '删除',
      no_transactions: '暂无交易。',
      no_groups: '暂无群组。',
      select_group_option: '选择群组',
      no_photos: '暂无照片。',
      users_empty_hint: '您可以创建家庭群组或使用邀请码加入。',
      announcement_title_content_required: '请至少用一种语言输入标题和内容。',
      answer_required: '请输入您的回复。',
      answer_save_failed: '保存回复失败。',
      answer_saved: '回复已保存。',
      answer_save_error: '保存回复失败。',
      answer_content_required: '请输入回复内容。',
      select_group_label: '选择要管理的群组',
      piggy_archive_transactions_title: '已归档的交易',
      view_transactions_btn: '查看交易',
    },
    'zh-TW': {
      confirm_delete_piggy_archive: '確定刪除此歸檔嗎？已刪除的交易紀錄無法復原。',
      error_piggy_archive_fetch: '取得歸檔失敗。',
      error_piggy_archive_list: '載入存錢筒歸檔失敗。',
      error_piggy_archive_detail: '載入詳情失敗。',
      error_piggy_archive_delete: '刪除失敗。',
      error_piggy_archive_delete_msg: '刪除歸檔失敗。',
      piggy_archive_section_title: '存錢筒歸檔（已刪除的存錢筒交易）',
      piggy_archive_deleted_at: '刪除時間',
      piggy_archive_account_name: '帳戶名稱',
      piggy_archive_deleted_by: '刪除者',
      no_piggy_archives: '尚無存錢筒歸檔。',
      archive_delete_btn: '刪除',
      no_transactions: '尚無交易。',
      no_groups: '尚無群組。',
      select_group_option: '選擇群組',
      no_photos: '尚無照片。',
      users_empty_hint: '您可以建立家庭群組或使用邀請碼加入。',
      announcement_title_content_required: '請至少用一種語言輸入標題和內容。',
      answer_required: '請輸入您的回覆。',
      answer_save_failed: '儲存回覆失敗。',
      answer_saved: '回覆已儲存。',
      answer_save_error: '儲存回覆失敗。',
      answer_content_required: '請輸入回覆內容。',
      select_group_label: '選擇要管理的群組',
      piggy_archive_transactions_title: '已歸檔的交易',
      view_transactions_btn: '查看交易',
    },
  },
  'groupAdmin.ts': {
    es: { tx_col_actor: 'Usuario' },
    fr: { content_section_photos: 'Photos (${count})' },
    ja: {
      theme_default_short: 'デフォルト',
      theme_stable_glass_short: 'ステーブルガラス',
      theme_highend_glass_short: 'ハイエンドガラス',
    },
    'zh-CN': {
      theme_default_short: '默认',
      theme_stable_glass_short: '稳定玻璃',
      theme_highend_glass_short: '高端玻璃',
    },
    'zh-TW': {
      theme_default_short: '預設',
      theme_stable_glass_short: '穩定玻璃',
      theme_highend_glass_short: '高端玻璃',
    },
  },
  'groupSettings.ts': {
    ja: {
      theme_stable_glass_label: 'ステーブルガラス',
      theme_highend_glass_label: 'ハイエンドガラス',
    },
    'zh-CN': {
      theme_stable_glass_label: '稳定玻璃',
      theme_highend_glass_label: '高端玻璃',
    },
    'zh-TW': {
      theme_stable_glass_label: '穩定玻璃',
      theme_highend_glass_label: '高端玻璃',
    },
  },
  'titlePage.ts': {
    ja: {
      font_weight_300: 'ライト (300)',
      font_weight_500: 'ミディアム (500)',
      font_weight_600: 'セミボールド (600)',
      font_weight_700: 'ボールド (700)',
      font_weight_800: 'エクストラボールド (800)',
      font_weight_900: 'ブラック (900)',
    },
  },
  'travel.ts': {
    de: {
      ui_expense_section: 'Ausgaben',
      placeholder_optional: 'Optional',
      placeholder_select: 'Optional',
      label_memo: 'Notiz',
    },
    fr: {
      ui_expense_section: 'Dépenses',
      label_destination: 'Destination',
      label_date: 'Date *',
      label_description: 'Description',
      label_lat_map: 'Latitude',
      label_lng_map: 'Longitude',
      section_attraction: 'Attractions',
      label_distance_km: 'Distance (km)',
      ui_photo: 'Photo',
    },
    it: { ui_expense_section: 'Spese' },
    ja: { itinerary_day_label: '{n}日目' },
  },
};

function patchKey(source, lang, key, value) {
  const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const keyPat = lang === 'zh-CN' || lang === 'zh-TW' ? `'${lang}'` : lang;
  const blockMarker = `\n  ${keyPat}: {`;
  const blockStart = source.indexOf(blockMarker);
  if (blockStart === -1) throw new Error(`block ${lang}`);
  const slice = source.slice(blockStart);
  const re = new RegExp(`(    ${key}: ')(?:\\\\.|[^'\\\\])*(',)`);
  const m = slice.match(re);
  if (!m) throw new Error(`key ${key} in ${lang}`);
  const abs = blockStart + m.index;
  return source.slice(0, abs) + m[1] + escaped + m[2] + source.slice(abs + m[0].length);
}

let total = 0;
for (const [file, byLang] of Object.entries(FIXES)) {
  const filePath = path.join(__dirname, '..', 'lib', 'translations', file);
  let source = fs.readFileSync(filePath, 'utf8');
  for (const [lang, keys] of Object.entries(byLang)) {
    for (const [key, value] of Object.entries(keys)) {
      source = patchKey(source, lang, key, value);
      total++;
    }
  }
  fs.writeFileSync(filePath, source, 'utf8');
  console.log('updated', file);
}
console.log('fixed', total, 'strings');
