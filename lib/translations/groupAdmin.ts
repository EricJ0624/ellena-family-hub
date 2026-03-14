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
  },
};

export function getGroupAdminTranslation(lang: LangCode, key: keyof GroupAdminTranslations): string {
  return groupAdmin[lang]?.[key] ?? groupAdmin.en[key] ?? (groupAdmin.ko[key] as string) ?? key;
}
