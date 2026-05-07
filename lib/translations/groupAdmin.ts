import type { LangCode } from '@/lib/language-fonts';

export type GroupAdminTranslations = {
  checking_permission: string;
  group_label: string;
  group_manage: string;
  loading: string;
  search_photo_placeholder: string;
  photo_label: string;
  no_filename: string;
  no_photos: string;
  no_name: string;
  no_locations: string;
  no_announcements: string;
  announcements_tab: string;
  announcements_section_unread: string;
  no_tickets: string;
  status_pending: string;
  status_answered: string;
  status_closed: string;
  status_approved: string;
  status_rejected: string;
  status_expired: string;
  status_cancelled: string;
  title_placeholder: string;
  content_placeholder: string;
  alert_title_content_required: string;
  alert_group_info: string;
  alert_auth: string;
  ticket_created: string;
  error_ticket_create: string;
  reason_placeholder: string;
  alert_reason_required: string;
  request_created: string;
  error_request_create: string;
  confirm_cancel_request: string;
  request_cancelled: string;
  error_request_cancel: string;
  no_requests: string;
  confirm_delete_photo: string;
  photo_deleted: string;
  error_delete_photo: string;
  written_at: string;
  answered_at: string;
  /** 그룹 관리 — 대시보드 위젯 탭 */
  widgets_tab: string;
  widgets_panel_title: string;
  widgets_panel_hint: string;
  widgets_edit_start: string;
  widgets_alert_min_one: string;
  widgets_error_save: string;
  widgets_no_group: string;
  widgets_owner_only: string;
  widgets_size_label: string;
  widgets_size_hint: string;
  widgets_size_S: string;
  widgets_size_M: string;
  widgets_size_L: string;
  widgets_size_XL: string;
  widgets_advanced_layout: string;
  widgets_col_span: string;
  widgets_row_span: string;
  active_theme: string;
  theme_default_short: string;
  theme_stable_glass_short: string;
  theme_highend_glass_short: string;
}

const groupAdmin: Record<LangCode, GroupAdminTranslations> = {
  ko: {
    checking_permission: '권한 확인 중...',
    group_label: '그룹',
    group_manage: '관리',
    loading: '로딩 중...',
    search_photo_placeholder: '파일명, 설명으로 검색...',
    photo_label: '사진',
    no_filename: '파일명 없음',
    no_photos: '사진이 없습니다.',
    no_name: '이름 없음',
    no_locations: '위치 데이터가 없습니다.',
    no_announcements: '공지사항이 없습니다.',
    announcements_tab: '공지사항',
    announcements_section_unread: '공지사항 (${count}개 읽지 않음)',
    no_tickets: '문의가 없습니다.',
    status_pending: '대기중',
    status_answered: '답변완료',
    status_closed: '종료',
    status_approved: '승인됨',
    status_rejected: '거절됨',
    status_expired: '만료됨',
    status_cancelled: '취소됨',
    title_placeholder: '제목을 입력하세요..',
    content_placeholder: '문의 내용을 입력하세요..',
    alert_title_content_required: '제목과 내용 모두 입력해주세요.',
    alert_group_info: '그룹 정보를 가져올 수 없습니다.',
    alert_auth: '인증 정보를 가져올 수 없습니다.',
    ticket_created: '문의가 작성되었습니다.',
    error_ticket_create: '문의 작성 중 오류가 발생했습니다.',
    reason_placeholder: '접근 요청 사유를 입력하세요 (예: 기술 지원이 필요합니다...)',
    alert_reason_required: '접근 요청 사유를 입력해주세요.',
    request_created: '접근 요청이 생성되었습니다.',
    error_request_create: '접근 요청 생성 중 오류가 발생했습니다.',
    confirm_cancel_request: '정말로 접근 요청을 취소하시겠습니까?',
    request_cancelled: '접근 요청이 취소되었습니다.',
    error_request_cancel: '접근 요청 취소 중 오류가 발생했습니다.',
    no_requests: '접근 요청이 없습니다.',
    confirm_delete_photo: '정말로 이 사진을 삭제하시겠습니까?',
    photo_deleted: '사진이 삭제되었습니다.',
    error_delete_photo: '사진 삭제 중 오류가 발생했습니다.',
    written_at: '작성일:',
    answered_at: '답변일:',
    widgets_tab: '대시보드 위젯',
    widgets_panel_title: '대시보드 위젯',
    widgets_panel_hint: '가족 대시보드에 표시할 위젯의 순서와 표시 여부를 설정합니다. 변경 후 저장해야 반영됩니다.',
    widgets_edit_start: '편집 시작',
    widgets_alert_min_one: '최소 1개 위젯은 켜져 있어야 합니다.',
    widgets_error_save: '위젯 설정 저장에 실패했습니다.',
    widgets_no_group: '선택된 그룹이 없습니다.',
    widgets_owner_only: '그룹 소유자만 위젯을 편집할 수 있습니다.',
    widgets_size_label: '표시 크기',
    widgets_size_hint: '넓은 화면에서 그리드로 배치됩니다. 좁은 화면에서는 자동으로 줄어듭니다.',
    widgets_size_S: 'S (작게)',
    widgets_size_M: 'M (기본)',
    widgets_size_L: 'L (넓게)',
    widgets_size_XL: 'XL (넓게·높게)',
    widgets_advanced_layout: '칸(span) 직접 지정',
    widgets_col_span: '가로 span',
    widgets_row_span: '세로 span',
    active_theme: '현재 테마',
    theme_default_short: 'Default',
    theme_stable_glass_short: 'Stable Glass',
    theme_highend_glass_short: 'High-end Glass',
  },
  en: {
    checking_permission: 'Checking permission...',
    group_label: 'Group',
    group_manage: 'Manage',
    loading: 'Loading...',
    search_photo_placeholder: 'Search by filename, description...',
    photo_label: 'Photo',
    no_filename: 'No filename',
    no_photos: 'No photos.',
    no_name: 'No name',
    no_locations: 'No location data.',
    no_announcements: 'No announcements.',
    announcements_tab: 'Announcements',
    announcements_section_unread: 'Announcements (${count} unread)',
    no_tickets: 'No support tickets.',
    status_pending: 'Pending',
    status_answered: 'Answered',
    status_closed: 'Closed',
    status_approved: 'Approved',
    status_rejected: 'Rejected',
    status_expired: 'Expired',
    status_cancelled: 'Cancelled',
    title_placeholder: 'Enter title...',
    content_placeholder: 'Enter your message...',
    alert_title_content_required: 'Please enter both title and content.',
    alert_group_info: 'Could not get group info.',
    alert_auth: 'Could not get auth.',
    ticket_created: 'Ticket created.',
    error_ticket_create: 'Failed to create ticket.',
    reason_placeholder: 'Enter reason for access request (e.g. I need technical support...)',
    alert_reason_required: 'Please enter a reason.',
    request_created: 'Access request created.',
    error_request_create: 'Failed to create access request.',
    confirm_cancel_request: 'Cancel this access request?',
    request_cancelled: 'Access request cancelled.',
    error_request_cancel: 'Failed to cancel request.',
    no_requests: 'No access requests.',
    confirm_delete_photo: 'Delete this photo?',
    photo_deleted: 'Photo deleted.',
    error_delete_photo: 'Failed to delete photo.',
    written_at: 'Written:',
    answered_at: 'Answered:',
    widgets_tab: 'Dashboard widgets',
    widgets_panel_title: 'Dashboard widgets',
    widgets_panel_hint: 'Choose which widgets appear on the family dashboard and their order. Save to apply.',
    widgets_edit_start: 'Edit',
    widgets_alert_min_one: 'At least one widget must stay enabled.',
    widgets_error_save: 'Failed to save widget settings.',
    widgets_no_group: 'No group selected.',
    widgets_owner_only: 'Only the group owner can edit widgets.',
    widgets_size_label: 'Display size',
    widgets_size_hint: 'Uses the dashboard grid on wide screens; narrows automatically on small screens.',
    widgets_size_S: 'S (compact)',
    widgets_size_M: 'M (default)',
    widgets_size_L: 'L (wide)',
    widgets_size_XL: 'XL (wide & tall)',
    widgets_advanced_layout: 'Custom span',
    widgets_col_span: 'Column span',
    widgets_row_span: 'Row span',
    active_theme: 'Active theme',
    theme_default_short: 'Default',
    theme_stable_glass_short: 'Stable Glass',
    theme_highend_glass_short: 'High-end Glass',
  },
  ja: {
    checking_permission: '権限確認中...',
    group_label: 'グループ',
    group_manage: '管理',
    loading: '読み込み中...',
    search_photo_placeholder: 'ファイル名・説明で検索...',
    photo_label: '写真',
    no_filename: 'ファイル名なし',
    no_photos: '写真がありません。',
    no_name: '名前なし',
    no_locations: '位置データがありません。',
    no_announcements: 'お知らせがありません。',
    announcements_tab: 'お知らせ',
    announcements_section_unread: 'お知らせ（${count}件未読）',
    no_tickets: 'お問い合わせがありません。',
    status_pending: '対応中',
    status_answered: '回答済み',
    status_closed: '終了',
    status_approved: '承認',
    status_rejected: '却下',
    status_expired: '期限切れ',
    status_cancelled: 'キャンセル',
    title_placeholder: 'タイトルを入力...',
    content_placeholder: '内容を入力...',
    alert_title_content_required: 'タイトルと内容を入力してください。',
    alert_group_info: 'グループ情報を取得できません。',
    alert_auth: '認証情報を取得できません。',
    ticket_created: 'お問い合わせを送信しました。',
    error_ticket_create: '送信に失敗しました。',
    reason_placeholder: 'アクセス申請の理由を入力（例：サポートが必要です）',
    alert_reason_required: '理由を入力してください。',
    request_created: 'アクセス申請を作成しました。',
    error_request_create: '作成に失敗しました。',
    confirm_cancel_request: 'アクセス申請をキャンセルしますか？',
    request_cancelled: 'アクセス申請をキャンセルしました。',
    error_request_cancel: 'キャンセルに失敗しました。',
    no_requests: 'アクセス申請がありません。',
    confirm_delete_photo: 'この写真を削除しますか？',
    photo_deleted: '写真を削除しました。',
    error_delete_photo: '削除に失敗しました。',
    written_at: '作成日：',
    answered_at: '返信日：',
    widgets_tab: 'ダッシュボードウィジェット',
    widgets_panel_title: 'ダッシュボードウィジェット',
    widgets_panel_hint: '家族ダッシュボードに表示するウィジェットと順序を設定します。保存で反映されます。',
    widgets_edit_start: '編集',
    widgets_alert_min_one: '少なくとも1つのウィジェットを有効にしてください。',
    widgets_error_save: 'ウィジェット設定の保存に失敗しました。',
    widgets_no_group: 'グループが選択されていません。',
    widgets_owner_only: 'グループオーナーのみ編集できます。',
    widgets_size_label: '表示サイズ',
    widgets_size_hint: '広い画面ではグリッドで配置されます。狭い画面では自動的に縮みます。',
    widgets_size_S: 'S（小）',
    widgets_size_M: 'M（標準）',
    widgets_size_L: 'L（広め）',
    widgets_size_XL: 'XL（広め・高め）',
    widgets_advanced_layout: 'span を直接指定',
    widgets_col_span: '横 span',
    widgets_row_span: '縦 span',
    active_theme: '現在のテーマ',
    theme_default_short: 'Default',
    theme_stable_glass_short: 'Stable Glass',
    theme_highend_glass_short: 'High-end Glass',
  },
  'zh-CN': {
    checking_permission: '正在验证权限...',
    group_label: '群组',
    group_manage: '管理',
    loading: '加载中...',
    search_photo_placeholder: '按文件名、说明搜索...',
    photo_label: '照片',
    no_filename: '无文件名',
    no_photos: '暂无照片。',
    no_name: '无名称',
    no_locations: '暂无位置数据。',
    no_announcements: '暂无公告。',
    announcements_tab: '公告',
    announcements_section_unread: '公告（${count} 条未读）',
    no_tickets: '暂无工单。',
    status_pending: '待处理',
    status_answered: '已回复',
    status_closed: '已关闭',
    status_approved: '已批准',
    status_rejected: '已拒绝',
    status_expired: '已过期',
    status_cancelled: '已取消',
    title_placeholder: '请输入标题...',
    content_placeholder: '请输入内容...',
    alert_title_content_required: '请填写标题和内容。',
    alert_group_info: '无法获取群组信息。',
    alert_auth: '无法获取认证信息。',
    ticket_created: '工单已提交。',
    error_ticket_create: '提交失败。',
    reason_placeholder: '请输入访问请求理由（如：需要技术支持）',
    alert_reason_required: '请输入理由。',
    request_created: '已创建访问请求。',
    error_request_create: '创建失败。',
    confirm_cancel_request: '确定取消此访问请求？',
    request_cancelled: '已取消访问请求。',
    error_request_cancel: '取消失败。',
    no_requests: '暂无访问请求。',
    confirm_delete_photo: '确定删除此照片？',
    photo_deleted: '照片已删除。',
    error_delete_photo: '删除失败。',
    written_at: '创建日：',
    answered_at: '回复日：',
    widgets_tab: '仪表盘小组件',
    widgets_panel_title: '仪表盘小组件',
    widgets_panel_hint: '设置家庭仪表盘显示的小组件及顺序。保存后生效。',
    widgets_edit_start: '开始编辑',
    widgets_alert_min_one: '至少需要启用一个小组件。',
    widgets_error_save: '保存小组件设置失败。',
    widgets_no_group: '未选择群组。',
    widgets_owner_only: '仅群主可编辑小组件。',
    widgets_size_label: '显示大小',
    widgets_size_hint: '宽屏使用网格布局；窄屏会自动收缩。',
    widgets_size_S: 'S（紧凑）',
    widgets_size_M: 'M（默认）',
    widgets_size_L: 'L（宽）',
    widgets_size_XL: 'XL（宽且高）',
    widgets_advanced_layout: '自定义 span',
    widgets_col_span: '列 span',
    widgets_row_span: '行 span',
    active_theme: '当前主题',
    theme_default_short: 'Default',
    theme_stable_glass_short: 'Stable Glass',
    theme_highend_glass_short: 'High-end Glass',
  },
  'zh-TW': {
    checking_permission: '正在驗證權限...',
    group_label: '群組',
    group_manage: '管理',
    loading: '載入中...',
    search_photo_placeholder: '以檔案名稱、說明搜尋...',
    photo_label: '照片',
    no_filename: '無檔案名稱',
    no_photos: '尚無照片。',
    no_name: '無名稱',
    no_locations: '尚無位置資料。',
    no_announcements: '尚無公告。',
    announcements_tab: '公告',
    announcements_section_unread: '公告（${count} 則未讀）',
    no_tickets: '尚無工單。',
    status_pending: '待處理',
    status_answered: '已回覆',
    status_closed: '已關閉',
    status_approved: '已核准',
    status_rejected: '已拒絕',
    status_expired: '已過期',
    status_cancelled: '已取消',
    title_placeholder: '請輸入標題...',
    content_placeholder: '請輸入內容...',
    alert_title_content_required: '請填寫標題與內容。',
    alert_group_info: '無法取得群組資訊。',
    alert_auth: '無法取得認證資訊。',
    ticket_created: '工單已送出。',
    error_ticket_create: '送出失敗。',
    reason_placeholder: '請輸入存取請求理由（例：需要技術支援）',
    alert_reason_required: '請輸入理由。',
    request_created: '已建立存取請求。',
    error_request_create: '建立失敗。',
    confirm_cancel_request: '確定要取消此存取請求？',
    request_cancelled: '已取消存取請求。',
    error_request_cancel: '取消失敗。',
    no_requests: '尚無存取請求。',
    confirm_delete_photo: '確定要刪除此照片？',
    photo_deleted: '照片已刪除。',
    error_delete_photo: '刪除失敗。',
    written_at: '建立日：',
    answered_at: '回覆日：',
    widgets_tab: '儀表板小工具',
    widgets_panel_title: '儀表板小工具',
    widgets_panel_hint: '設定家庭儀表板顯示的小工具與順序。儲存後生效。',
    widgets_edit_start: '開始編輯',
    widgets_alert_min_one: '至少需要啟用一個小工具。',
    widgets_error_save: '儲存小工具設定失敗。',
    widgets_no_group: '未選擇群組。',
    widgets_owner_only: '僅群組擁有者可編輯小工具。',
    widgets_size_label: '顯示大小',
    widgets_size_hint: '寬螢幕使用網格版面；窄螢幕會自動縮小。',
    widgets_size_S: 'S（緊湊）',
    widgets_size_M: 'M（預設）',
    widgets_size_L: 'L（較寬）',
    widgets_size_XL: 'XL（較寬·較高）',
    widgets_advanced_layout: '自訂 span',
    widgets_col_span: '欄 span',
    widgets_row_span: '列 span',
    active_theme: '目前主題',
    theme_default_short: 'Default',
    theme_stable_glass_short: 'Stable Glass',
    theme_highend_glass_short: 'High-end Glass',
  },
};

export function getGroupAdminTranslation(lang: LangCode, key: keyof GroupAdminTranslations): string {
  return groupAdmin[lang]?.[key] ?? groupAdmin.en[key] ?? (groupAdmin.ko[key] as string) ?? key;
}
