import type { LangCode } from '@/lib/language-fonts';

export type DashboardTranslations = {
  // Todo modal
  todo_modal_title: string;
  todo_what_label: string;
  todo_what_placeholder: string;
  todo_who_label: string;
  todo_who_placeholder: string;
  todo_register_btn: string;
  todo_empty_state: string;
  todo_section_title: string;
  todo_add_btn: string;
  // Nickname modal
  nickname_modal_title: string;
  nickname_label: string;
  nickname_placeholder: string;
  nickname_save_btn: string;
  // Photo/album
  photo_add: string;
  photo_upload_prompt: string;
  photo_description_placeholder: string;
  photo_description_hint: string;
  photo_delete_confirm: string;
  // Event/calendar
  event_add_title: string;
  event_add_btn: string;
  event_title_label: string;
  event_title_placeholder: string;
  event_desc_label: string;
  event_desc_placeholder: string;
  event_repeat_label: string;
  event_repeat_none: string;
  event_repeat_monthly: string;
  event_repeat_yearly: string;
  event_author: string;
  event_no_events: string;
  event_add_hint: string;
  event_created_at: string;
  // Admin aria
  aria_system_admin: string;
  aria_group_admin: string;
  // Piggy
  piggy_manage_all: string;
  piggy_go: string;
  piggy_request_sent: string;
  piggy_request_received: string;
  piggy_add_failed: string;
  piggy_request_failed: string;
  piggy_request_delivered: string;
  piggy_approve_failed: string;
  piggy_reject_failed: string;
  piggy_delete_confirm: string;
  piggy_delete_failed: string;
  piggy_travel_fetch_failed: string;
  // Location
  location_my: string;
  location_word: string; // "위치" / "location"
  location_of: string; // "의 위치" suffix
  location_share_btn: string; // "여기야" or "Share location"
  event_submit_btn: string; // "추가" in event modal
  chat_placeholder: string;
  chat_send: string;
  map_error_no_key: string;
  map_error_check_env: string;
  map_error_domain: string;
  map_error_load_failed: string;
  map_error_invalid_key: string;
  map_error_script_timeout: string;
  map_error_init_failed: string;
  map_error_console: string;
  // Storage/alerts
  storage_photo_cleanup: string;
  storage_full_auto: string;
  storage_full_manual: string;
  storage_full: string;
  // Auth
  auth_key_mismatch: string;
  nickname_update_failed: string;
  // Location request modal (if any)
  location_request_modal_title: string;
  request_sent: string;
  request_received: string;
  // Account delete
  delete_account_aria: string;
  delete_account_btn: string;
  delete_confirm_1: string;
  delete_confirm_2: string;
  delete_success: string;
  delete_failed: string;
  delete_error: string;
  delete_transfer_warning: string;
  delete_transfer_select_successor: string;
  delete_transfer_auth_failed: string;
  delete_transfer_failed: string;
  delete_warning_owner_title: string;
  delete_warning_owner_groups: string;
  delete_warning_owner_deleted: string;
  delete_warning_owner_final: string;
};

const dashboard: Record<LangCode, DashboardTranslations> = {
  ko: {
    todo_modal_title: '새 할 일 등록',
    todo_what_label: '무엇을 할까요?',
    todo_what_placeholder: '할 일 내용 입력',
    todo_who_label: '누가 할까요?',
    todo_who_placeholder: '이름 입력 (비워두면 누구나)',
    todo_register_btn: '등록하기',
    todo_empty_state: '할 일을 모두 완료했습니다! 🎉',
    todo_section_title: 'Family Tasks',
    todo_add_btn: '+ ADD',
    nickname_modal_title: '닉네임 설정',
    nickname_label: '닉네임 (2-20자)',
    nickname_placeholder: '닉네임을 입력하세요',
    nickname_save_btn: '저장하기',
    photo_add: '사진 추가',
    photo_upload_prompt: '사진을 업로드해보세요',
    photo_description_placeholder: '사진 설명을 입력하세요',
    photo_description_hint: '설명 추가하기 (클릭)',
    photo_delete_confirm: '사진을 삭제하시겠습니까?',
    event_add_title: '일정 추가',
    event_add_btn: '일정 추가하기',
    event_title_label: '제목 *',
    event_title_placeholder: '일정 제목을 입력하세요',
    event_desc_label: '설명 (선택)',
    event_desc_placeholder: '일정 설명을 입력하세요',
    event_repeat_label: '반복',
    event_repeat_none: '반복 없음',
    event_repeat_monthly: '매월 반복',
    event_repeat_yearly: '매년 반복',
    event_author: '작성자',
    event_no_events: '해당 날짜에 등록된 일정이 없습니다.',
    event_add_hint: '아래 버튼으로 일정을 추가해 보세요.',
    event_created_at: '등록',
    aria_system_admin: '시스템 관리자 페이지',
    aria_group_admin: '그룹 관리자 페이지',
    piggy_manage_all: '전체 관리',
    piggy_go: '이동',
    piggy_request_sent: '요청 보냄',
    piggy_request_received: '요청 받음',
    piggy_add_failed: '저금통 추가에 실패했습니다.',
    piggy_request_failed: '요청에 실패했습니다.',
    piggy_request_delivered: '요청이 전달되었습니다.',
    piggy_approve_failed: '승인에 실패했습니다.',
    piggy_reject_failed: '거절에 실패했습니다.',
    piggy_delete_confirm: '이 사용자의 저금통을 삭제하시겠습니까? 잔액 데이터가 삭제됩니다.',
    piggy_delete_failed: '삭제에 실패했습니다.',
    piggy_travel_fetch_failed: '여행 목록 조회 실패',
    location_my: '내',
    location_word: '위치',
    location_of: '의 위치',
    location_share_btn: '여기야',
    event_submit_btn: '추가',
    chat_placeholder: '메시지 입력...',
    chat_send: '전송',
    map_error_no_key: 'Google Maps API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.',
    map_error_check_env: 'Google Maps API 키 설정 오류: Google Cloud Console에서 API 키의 도메인 제한 설정을 확인하고, Maps JavaScript API가 활성화되어 있는지 확인해주세요.',
    map_error_domain: '현재 도메인에서 Google Maps API를 사용할 수 없습니다. Google Cloud Console → API 및 서비스 → 사용자 인증 정보에서 API 키의 HTTP 리퍼러(웹사이트) 제한에 Vercel 도메인을 추가해주세요.',
    map_error_load_failed: 'Google Maps를 불러오는데 실패했습니다. Google Cloud Console에서 Maps JavaScript API 활성화 및 결제 계정 연결을 확인해주세요.',
    map_error_invalid_key: 'Google Maps API 키가 유효하지 않습니다. API 키와 도메인 제한 설정을 확인해주세요.',
    map_error_script_timeout: 'Google Maps API 스크립트를 불러오는데 시간이 오래 걸립니다. API 키와 설정을 확인해주세요.',
    map_error_init_failed: 'Google Maps를 초기화하는데 실패했습니다. API 키와 설정을 확인해주세요.',
    map_error_console: 'Google Maps API 스크립트를 불러오는데 실패했습니다. 브라우저 콘솔과 Google Cloud Console의 로그 탐색기를 확인해주세요.',
    storage_photo_cleanup: '저장 공간이 부족하여 오래된 사진이 자동으로 삭제되었습니다.',
    storage_full_auto: '브라우저 저장 공간이 가득 찼습니다. 오래된 사진을 수동으로 삭제해 주세요.',
    storage_full_manual: '브라우저 저장 공간이 가득 찼습니다. 오래된 사진을 삭제해 주세요.',
    storage_full: '브라우저 저장 공간이 가득 찼습니다. 오래된 사진을 삭제해 주세요.',
    auth_key_mismatch: '보안 키가 일치하지 않습니다.',
    nickname_update_failed: '닉네임 업데이트 실패: ',
    location_request_modal_title: '위치 공유 요청',
    request_sent: '요청 보냄',
    request_received: '요청 받음',
    delete_account_aria: '회원탈퇴',
    delete_account_btn: '회원탈퇴',
    delete_confirm_1: '⚠️ 정말로 회원탈퇴를 하시겠습니까?\n\n탈퇴 시 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.',
    delete_confirm_2: '⚠️ 최종 확인\n\n회원탈퇴를 진행하시겠습니까?',
    delete_success: '회원탈퇴가 완료되었습니다.',
    delete_failed: '회원탈퇴에 실패했습니다.',
    delete_error: '회원탈퇴 처리 중 오류가 발생했습니다.',
    delete_transfer_warning: '시스템 관리자는 회원탈퇴 전에 반드시 후임자를 지정해야 합니다.',
    delete_transfer_select_successor: '후임자를 선택해주세요.',
    delete_transfer_auth_failed: '인증 정보를 가져올 수 없습니다.',
    delete_transfer_failed: '후임자 지정에 실패했습니다.',
    delete_warning_owner_title: '⚠️ 그룹 소유자 탈퇴 경고\n\n회원탈퇴 시 다음 사항이 발생합니다:',
    delete_warning_owner_groups: '📋 소유한 그룹:',
    delete_warning_owner_deleted: '⚠️ 삭제되는 내용:\n• 소유한 그룹이 영구적으로 삭제됩니다\n• 그룹의 모든 데이터가 삭제됩니다 (사진, 일정, 메모, 저금통 등)\n• 그룹의 모든 멤버가 자동으로 탈퇴됩니다\n• 이 작업은 되돌릴 수 없습니다',
    delete_warning_owner_final: '정말로 탈퇴하시겠습니까?',
  },
  en: {
    todo_modal_title: 'New task',
    todo_what_label: "What to do?",
    todo_what_placeholder: 'Enter task',
    todo_who_label: 'Who will do it?',
    todo_who_placeholder: 'Name (leave blank for anyone)',
    todo_register_btn: 'Add',
    todo_empty_state: 'All tasks done! 🎉',
    todo_section_title: 'Family Tasks',
    todo_add_btn: '+ ADD',
    nickname_modal_title: 'Nickname',
    nickname_label: 'Nickname (2-20 characters)',
    nickname_placeholder: 'Enter nickname',
    nickname_save_btn: 'Save',
    photo_add: 'Add photo',
    photo_upload_prompt: 'Upload a photo',
    photo_description_placeholder: 'Enter photo description',
    photo_description_hint: 'Add description (click)',
    photo_delete_confirm: 'Delete this photo?',
    event_add_title: 'Add event',
    event_add_btn: 'Add event',
    event_title_label: 'Title *',
    event_title_placeholder: 'Enter event title',
    event_desc_label: 'Description (optional)',
    event_desc_placeholder: 'Enter event description',
    event_repeat_label: 'Repeat',
    event_repeat_none: 'No repeat',
    event_repeat_monthly: 'Monthly',
    event_repeat_yearly: 'Yearly',
    event_author: 'Author',
    event_no_events: 'No events on this date.',
    event_add_hint: 'Add an event using the button below.',
    event_created_at: 'Created',
    aria_system_admin: 'System admin page',
    aria_group_admin: 'Group admin page',
    piggy_manage_all: 'Manage all',
    piggy_go: 'Go',
    piggy_request_sent: 'Request sent',
    piggy_request_received: 'Request received',
    piggy_add_failed: 'Failed to add piggy bank.',
    piggy_request_failed: 'Request failed.',
    piggy_request_delivered: 'Request delivered.',
    piggy_approve_failed: 'Approval failed.',
    piggy_reject_failed: 'Rejection failed.',
    piggy_delete_confirm: 'Delete this user\'s piggy bank? Balance data will be removed.',
    piggy_delete_failed: 'Delete failed.',
    piggy_travel_fetch_failed: 'Failed to load travel list.',
    location_my: 'My',
    location_word: 'location',
    location_of: '\'s location',
    location_share_btn: 'Share location',
    event_submit_btn: 'Add',
    chat_placeholder: 'Type a message...',
    chat_send: 'Send',
    map_error_no_key: 'Google Maps API key is not set. Check your environment variables.',
    map_error_check_env: 'Google Maps API error: Check API key domain restrictions and enable Maps JavaScript API in Google Cloud Console.',
    map_error_domain: 'Google Maps API is not available on this domain. Add your domain to the API key HTTP referrer restrictions in Google Cloud Console.',
    map_error_load_failed: 'Failed to load Google Maps. Check Maps JavaScript API and billing in Google Cloud Console.',
    map_error_invalid_key: 'Invalid Google Maps API key. Check key and domain restrictions.',
    map_error_script_timeout: 'Google Maps script is taking too long to load. Check API key and settings.',
    map_error_init_failed: 'Failed to initialize Google Maps. Check API key and settings.',
    map_error_console: 'Failed to load Google Maps script. Check browser console and Google Cloud Console.',
    storage_photo_cleanup: 'Old photos were automatically removed due to low storage.',
    storage_full_auto: 'Storage is full. Please delete some old photos manually.',
    storage_full_manual: 'Storage is full. Please delete some old photos.',
    storage_full: 'Storage is full. Please delete some old photos.',
    auth_key_mismatch: 'Security key does not match.',
    nickname_update_failed: 'Nickname update failed: ',
    location_request_modal_title: 'Location share request',
    request_sent: 'Request sent',
    request_received: 'Request received',
    delete_account_aria: 'Delete account',
    delete_account_btn: 'Delete account',
    delete_confirm_1: 'Are you sure you want to delete your account?\n\nAll data will be permanently deleted and cannot be recovered.',
    delete_confirm_2: 'Final confirmation: Do you want to proceed with account deletion?',
    delete_success: 'Your account has been deleted.',
    delete_failed: 'Account deletion failed.',
    delete_error: 'An error occurred while processing your request.',
    delete_transfer_warning: 'System admins must designate a successor before deleting their account.',
    delete_transfer_select_successor: 'Please select a successor.',
    delete_transfer_auth_failed: 'Could not retrieve authentication.',
    delete_transfer_failed: 'Failed to transfer to successor.',
    delete_warning_owner_title: '⚠️ Group owner deletion warning\n\nThe following will happen when you delete your account:',
    delete_warning_owner_groups: '📋 Groups you own:',
    delete_warning_owner_deleted: '⚠️ What will be deleted:\n• Groups you own will be permanently deleted\n• All group data will be deleted (photos, events, notes, piggy bank, etc.)\n• All group members will be removed\n• This cannot be undone',
    delete_warning_owner_final: 'Do you really want to delete your account?',
  },
  ja: {
    todo_modal_title: '新しいタスク',
    todo_what_label: '何をしますか？',
    todo_what_placeholder: 'タスクを入力',
    todo_who_label: '誰がやりますか？',
    todo_who_placeholder: '名前（空欄で誰でも）',
    todo_register_btn: '登録',
    todo_empty_state: 'タスク完了！🎉',
    todo_section_title: 'Family Tasks',
    todo_add_btn: '+ ADD',
    nickname_modal_title: 'ニックネーム設定',
    nickname_label: 'ニックネーム（2〜20文字）',
    nickname_placeholder: 'ニックネームを入力',
    nickname_save_btn: '保存',
    photo_add: '写真を追加',
    photo_upload_prompt: '写真をアップロード',
    photo_description_placeholder: '写真の説明を入力',
    photo_description_hint: '説明を追加（クリック）',
    photo_delete_confirm: 'この写真を削除しますか？',
    event_add_title: '予定を追加',
    event_add_btn: '予定を追加',
    event_title_label: 'タイトル *',
    event_title_placeholder: '予定のタイトルを入力',
    event_desc_label: '説明（任意）',
    event_desc_placeholder: '予定の説明を入力',
    event_repeat_label: '繰り返し',
    event_repeat_none: '繰り返さない',
    event_repeat_monthly: '毎月',
    event_repeat_yearly: '毎年',
    event_author: '作成者',
    event_no_events: 'この日に予定はありません。',
    event_add_hint: '下のボタンで予定を追加してください。',
    event_created_at: '登録',
    aria_system_admin: 'システム管理ページ',
    aria_group_admin: 'グループ管理ページ',
    piggy_manage_all: 'すべて管理',
    piggy_go: '移動',
    piggy_request_sent: 'リクエスト送信済み',
    piggy_request_received: 'リクエスト受信',
    piggy_add_failed: '貯金箱の追加に失敗しました。',
    piggy_request_failed: 'リクエストに失敗しました。',
    piggy_request_delivered: 'リクエストが送信されました。',
    piggy_approve_failed: '承認に失敗しました。',
    piggy_reject_failed: '拒否に失敗しました。',
    piggy_delete_confirm: 'このユーザーの貯金箱を削除しますか？残高データも削除されます。',
    piggy_delete_failed: '削除に失敗しました。',
    piggy_travel_fetch_failed: '旅行リストの取得に失敗しました。',
    location_my: '自分の',
    location_word: '位置',
    location_of: 'の位置',
    location_share_btn: '位置を共有',
    event_submit_btn: '追加',
    chat_placeholder: 'メッセージを入力...',
    chat_send: '送信',
    map_error_no_key: 'Google Maps APIキーが設定されていません。環境変数を確認してください。',
    map_error_check_env: 'Google Maps APIエラー: Google Cloud ConsoleでAPIキーの制限とMaps JavaScript APIの有効化を確認してください。',
    map_error_domain: 'このドメインではGoogle Maps APIを使用できません。Google Cloud ConsoleでAPIキーのHTTPリファラ制限にドメインを追加してください。',
    map_error_load_failed: 'Google Mapsの読み込みに失敗しました。Google Cloud ConsoleでMaps JavaScript APIと請求を確認してください。',
    map_error_invalid_key: 'Google Maps APIキーが無効です。キーとドメイン制限を確認してください。',
    map_error_script_timeout: 'Google Mapsスクリプトの読み込みがタイムアウトしました。APIキーと設定を確認してください。',
    map_error_init_failed: 'Google Mapsの初期化に失敗しました。APIキーと設定を確認してください。',
    map_error_console: 'Google Mapsスクリプトの読み込みに失敗しました。ブラウザコンソールとGoogle Cloud Consoleを確認してください。',
    storage_photo_cleanup: '保存容量不足のため、古い写真を自動削除しました。',
    storage_full_auto: '保存容量が不足しています。古い写真を手動で削除してください。',
    storage_full_manual: '保存容量が不足しています。古い写真を削除してください。',
    storage_full: '保存容量が不足しています。古い写真を削除してください。',
    auth_key_mismatch: 'セキュリティキーが一致しません。',
    nickname_update_failed: 'ニックネームの更新に失敗しました: ',
    location_request_modal_title: '位置情報共有リクエスト',
    request_sent: '送信済み',
    request_received: '受信',
    delete_account_aria: '退会',
    delete_account_btn: '退会',
    delete_confirm_1: '本当に退会しますか？\n\n退会するとすべてのデータが完全に削除され、復元できません。',
    delete_confirm_2: '最終確認：退会を実行しますか？',
    delete_success: '退会が完了しました。',
    delete_failed: '退会に失敗しました。',
    delete_error: '処理中にエラーが発生しました。',
    delete_transfer_warning: 'システム管理者は退会前に後任を指定する必要があります。',
    delete_transfer_select_successor: '後任を選択してください。',
    delete_transfer_auth_failed: '認証情報を取得できませんでした。',
    delete_transfer_failed: '後任への引き継ぎに失敗しました。',
    delete_warning_owner_title: '⚠️ グループオーナー退会の警告\n\n退会すると以下のことが発生します：',
    delete_warning_owner_groups: '📋 所有しているグループ：',
    delete_warning_owner_deleted: '⚠️ 削除される内容：\n• 所有しているグループは完全に削除されます\n• グループのすべてのデータが削除されます（写真、予定、メモ、貯金箱など）\n• グループの全メンバーが自動的に退会します\n• この操作は元に戻せません',
    delete_warning_owner_final: '本当に退会しますか？',
  },
  'zh-CN': {
    todo_modal_title: '新建任务',
    todo_what_label: '做什么？',
    todo_what_placeholder: '输入任务内容',
    todo_who_label: '谁来做？',
    todo_who_placeholder: '姓名（留空为任何人）',
    todo_register_btn: '添加',
    todo_empty_state: '任务全部完成！🎉',
    todo_section_title: 'Family Tasks',
    todo_add_btn: '+ ADD',
    nickname_modal_title: '昵称设置',
    nickname_label: '昵称（2-20字）',
    nickname_placeholder: '请输入昵称',
    nickname_save_btn: '保存',
    photo_add: '添加照片',
    photo_upload_prompt: '上传照片',
    photo_description_placeholder: '输入照片说明',
    photo_description_hint: '添加说明（点击）',
    photo_delete_confirm: '确定要删除这张照片吗？',
    event_add_title: '添加日程',
    event_add_btn: '添加日程',
    event_title_label: '标题 *',
    event_title_placeholder: '输入日程标题',
    event_desc_label: '说明（选填）',
    event_desc_placeholder: '输入日程说明',
    event_repeat_label: '重复',
    event_repeat_none: '不重复',
    event_repeat_monthly: '每月',
    event_repeat_yearly: '每年',
    event_author: '作者',
    event_no_events: '该日期暂无日程。',
    event_add_hint: '点击下方按钮添加日程。',
    event_created_at: '创建',
    aria_system_admin: '系统管理页',
    aria_group_admin: '群组管理页',
    piggy_manage_all: '管理全部',
    piggy_go: '前往',
    piggy_request_sent: '已发送请求',
    piggy_request_received: '收到请求',
    piggy_add_failed: '添加存钱罐失败。',
    piggy_request_failed: '请求失败。',
    piggy_request_delivered: '请求已送达。',
    piggy_approve_failed: '批准失败。',
    piggy_reject_failed: '拒绝失败。',
    piggy_delete_confirm: '确定删除该用户的存钱罐？余额数据将被删除。',
    piggy_delete_failed: '删除失败。',
    piggy_travel_fetch_failed: '获取旅行列表失败。',
    location_my: '我的',
    location_word: '位置',
    location_of: '的位置',
    location_share_btn: '分享位置',
    event_submit_btn: '添加',
    chat_placeholder: '输入消息...',
    chat_send: '发送',
    map_error_no_key: '未设置 Google Maps API 密钥。请检查环境变量。',
    map_error_check_env: 'Google Maps API 错误：请在 Google Cloud Console 中检查 API 密钥限制并启用 Maps JavaScript API。',
    map_error_domain: '当前域名无法使用 Google Maps API。请在 Google Cloud Console 的 API 密钥 HTTP 引荐来源限制中添加域名。',
    map_error_load_failed: '加载 Google Maps 失败。请在 Google Cloud Console 中检查 Maps JavaScript API 和结算。',
    map_error_invalid_key: 'Google Maps API 密钥无效。请检查密钥和域名限制。',
    map_error_script_timeout: 'Google Maps 脚本加载超时。请检查 API 密钥和设置。',
    map_error_init_failed: 'Google Maps 初始化失败。请检查 API 密钥和设置。',
    map_error_console: '加载 Google Maps 脚本失败。请检查浏览器控制台和 Google Cloud Console。',
    storage_photo_cleanup: '存储空间不足，已自动删除旧照片。',
    storage_full_auto: '存储空间已满，请手动删除部分旧照片。',
    storage_full_manual: '存储空间已满，请删除部分旧照片。',
    storage_full: '存储空间已满，请删除部分旧照片。',
    auth_key_mismatch: '安全密钥不匹配。',
    nickname_update_failed: '昵称更新失败：',
    location_request_modal_title: '位置分享请求',
    request_sent: '已发送',
    request_received: '已收到',
    delete_account_aria: '注销账户',
    delete_account_btn: '注销账户',
    delete_confirm_1: '确定要注销账户吗？\n\n注销后所有数据将被永久删除且无法恢复。',
    delete_confirm_2: '最终确认：是否继续注销账户？',
    delete_success: '账户已注销。',
    delete_failed: '注销失败。',
    delete_error: '处理过程中发生错误。',
    delete_transfer_warning: '系统管理员在注销前必须指定继任者。',
    delete_transfer_select_successor: '请选择继任者。',
    delete_transfer_auth_failed: '无法获取认证信息。',
    delete_transfer_failed: '指定继任者失败。',
    delete_warning_owner_title: '⚠️ 群组所有者注销警告\n\n注销账户后将发生以下情况：',
    delete_warning_owner_groups: '📋 您拥有的群组：',
    delete_warning_owner_deleted: '⚠️ 将被删除的内容：\n• 您拥有的群组将被永久删除\n• 群组所有数据将被删除（照片、日程、笔记、存钱罐等）\n• 群组所有成员将被移除\n• 此操作无法撤销',
    delete_warning_owner_final: '确定要注销账户吗？',
  },
  'zh-TW': {
    todo_modal_title: '新任務',
    todo_what_label: '要做什麼？',
    todo_what_placeholder: '輸入任務內容',
    todo_who_label: '誰來做？',
    todo_who_placeholder: '姓名（留空為任何人）',
    todo_register_btn: '新增',
    todo_empty_state: '任務全部完成！🎉',
    todo_section_title: 'Family Tasks',
    todo_add_btn: '+ ADD',
    nickname_modal_title: '暱稱設定',
    nickname_label: '暱稱（2-20字）',
    nickname_placeholder: '請輸入暱稱',
    nickname_save_btn: '儲存',
    photo_add: '新增照片',
    photo_upload_prompt: '上傳照片',
    photo_description_placeholder: '輸入照片說明',
    photo_description_hint: '新增說明（點擊）',
    photo_delete_confirm: '確定要刪除這張照片嗎？',
    event_add_title: '新增日程',
    event_add_btn: '新增日程',
    event_title_label: '標題 *',
    event_title_placeholder: '輸入日程標題',
    event_desc_label: '說明（選填）',
    event_desc_placeholder: '輸入日程說明',
    event_repeat_label: '重複',
    event_repeat_none: '不重複',
    event_repeat_monthly: '每月',
    event_repeat_yearly: '每年',
    event_author: '作者',
    event_no_events: '該日期尚無日程。',
    event_add_hint: '點擊下方按鈕新增日程。',
    event_created_at: '建立',
    aria_system_admin: '系統管理頁',
    aria_group_admin: '群組管理頁',
    piggy_manage_all: '管理全部',
    piggy_go: '前往',
    piggy_request_sent: '已發送請求',
    piggy_request_received: '收到請求',
    piggy_add_failed: '新增存錢筒失敗。',
    piggy_request_failed: '請求失敗。',
    piggy_request_delivered: '請求已送達。',
    piggy_approve_failed: '核准失敗。',
    piggy_reject_failed: '拒絕失敗。',
    piggy_delete_confirm: '確定刪除該使用者的存錢筒？餘額資料將被刪除。',
    piggy_delete_failed: '刪除失敗。',
    piggy_travel_fetch_failed: '取得旅行清單失敗。',
    location_my: '我的',
    location_word: '位置',
    location_of: '的位置',
    location_share_btn: '分享位置',
    event_submit_btn: '新增',
    chat_placeholder: '輸入訊息...',
    chat_send: '傳送',
    map_error_no_key: '未設定 Google Maps API 金鑰。請檢查環境變數。',
    map_error_check_env: 'Google Maps API 錯誤：請在 Google Cloud Console 中檢查 API 金鑰限制並啟用 Maps JavaScript API。',
    map_error_domain: '目前網域無法使用 Google Maps API。請在 Google Cloud Console 的 API 金鑰 HTTP 參照限制中新增網域。',
    map_error_load_failed: '載入 Google Maps 失敗。請在 Google Cloud Console 中檢查 Maps JavaScript API 與結帳。',
    map_error_invalid_key: 'Google Maps API 金鑰無效。請檢查金鑰與網域限制。',
    map_error_script_timeout: 'Google Maps 腳本載入逾時。請檢查 API 金鑰與設定。',
    map_error_init_failed: 'Google Maps 初始化失敗。請檢查 API 金鑰與設定。',
    map_error_console: '載入 Google Maps 腳本失敗。請檢查瀏覽器主控台與 Google Cloud Console。',
    storage_photo_cleanup: '儲存空間不足，已自動刪除舊照片。',
    storage_full_auto: '儲存空間已滿，請手動刪除部分舊照片。',
    storage_full_manual: '儲存空間已滿，請刪除部分舊照片。',
    storage_full: '儲存空間已滿，請刪除部分舊照片。',
    auth_key_mismatch: '安全金鑰不符。',
    nickname_update_failed: '暱稱更新失敗：',
    location_request_modal_title: '位置分享請求',
    request_sent: '已發送',
    request_received: '已收到',
    delete_account_aria: '刪除帳戶',
    delete_account_btn: '刪除帳戶',
    delete_confirm_1: '確定要刪除帳戶嗎？\n\n刪除後所有資料將永久刪除且無法復原。',
    delete_confirm_2: '最終確認：是否繼續刪除帳戶？',
    delete_success: '帳戶已刪除。',
    delete_failed: '刪除帳戶失敗。',
    delete_error: '處理過程中發生錯誤。',
    delete_transfer_warning: '系統管理員在刪除帳戶前必須指定繼任者。',
    delete_transfer_select_successor: '請選擇繼任者。',
    delete_transfer_auth_failed: '無法取得認證資訊。',
    delete_transfer_failed: '指定繼任者失敗。',
    delete_warning_owner_title: '⚠️ 群組擁有者刪除帳戶警告\n\n刪除帳戶後將發生以下情況：',
    delete_warning_owner_groups: '📋 您擁有的群組：',
    delete_warning_owner_deleted: '⚠️ 將被刪除的內容：\n• 您擁有的群組將被永久刪除\n• 群組所有資料將被刪除（照片、日程、筆記、存錢筒等）\n• 群組所有成員將被移除\n• 此操作無法復原',
    delete_warning_owner_final: '確定要刪除帳戶嗎？',
  },
};

export function getDashboardTranslation(lang: LangCode, key: keyof DashboardTranslations): string {
  return dashboard[lang]?.[key] ?? dashboard.en[key] ?? (dashboard.ko[key] as string) ?? key;
}
