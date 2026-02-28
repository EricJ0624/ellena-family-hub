import type { LangCode } from '@/lib/language-fonts';

export type OnboardingTranslations = {
  loading: string;
  title: string;
  subtitle: string;
  create_group: string;
  join_invite: string;
  first_member: string;
  already_family: string;
  back: string;
  group_name: string;
  group_name_placeholder: string;
  display_language: string;
  invite_code: string;
  share_code_hint: string;
  confirm_invite_hint: string;
  confirmed_btn: string;
  go_to_dashboard: string;
  invite_join_subtitle: string;
  invite_placeholder: string;
  verify_btn: string;
  group_info: string;
  member_count: string;
  member_count_suffix: string; // e.g. "명", " members", "人"
  join_btn: string;
  copy_title: string;
  create_btn: string;
  error_init: string;
  error_group_name_required: string;
  error_login_required: string;
  error_invite_code_failed: string;
  error_invite_required: string;
  error_invalid_invite: string;
  error_verify_failed: string;
  error_group_check: string;
  error_join_failed: string;
  error_copy_failed: string;
  error_create_failed: string;
  success_created: string;
  success_found: string;
  success_joined: string;
  success_copied: string;
  role_owner: string;
  role_admin: string;
  role_member: string;
  no_groups: string;
  select_group: string;
  creating: string;
  create_short: string; // "생성" button
  joining: string; // "가입 중..."
  join_short: string; // "가입" button
};

const onboarding: Record<LangCode, OnboardingTranslations> = {
  ko: {
    loading: '로딩 중...',
    title: '가족 그룹 설정',
    subtitle: '시작하기 전에 가족 그룹을 만들어주세요',
    create_group: '새 그룹 만들기',
    join_invite: '초대 코드로 가입',
    first_member: '첫 가족 구성원이 되시나요?',
    already_family: '이미 가족이 있으신가요?',
    back: '돌아가기',
    group_name: '그룹 이름',
    group_name_placeholder: '예: 우리 가족',
    display_language: '표시 언어',
    invite_code: '초대 코드',
    share_code_hint: '이 코드를 가족에게 공유하세요',
    confirm_invite_hint: '💡 초대코드는 관리자 페이지의 그룹설정에서 확인 가능합니다',
    confirmed_btn: '확인했습니다',
    go_to_dashboard: '가족 페이지로 이동',
    invite_join_subtitle: '가족으로부터 받은 초대 코드를 입력해주세요',
    invite_placeholder: '예: ABC123',
    verify_btn: '확인',
    group_info: '그룹 정보',
    member_count: '멤버 수',
    member_count_suffix: '명',
    join_btn: '가입하기',
    copy_title: '복사',
    create_btn: '그룹 만들기',
    error_init: '초기화 중 오류가 발생했습니다.',
    error_group_name_required: '그룹 이름을 입력해주세요.',
    error_login_required: '로그인이 필요합니다.',
    error_invite_code_failed: '초대 코드 생성에 실패했습니다.',
    error_invite_required: '초대 코드를 입력해주세요.',
    error_invalid_invite: '올바른 초대 코드를 입력해주세요.',
    error_verify_failed: '초대 코드 검증에 실패했습니다.',
    error_group_check: '그룹 정보를 확인해주세요.',
    error_join_failed: '그룹 가입에 실패했습니다.',
    error_copy_failed: '복사에 실패했습니다.',
    error_create_failed: '그룹 생성에 실패했습니다.',
    success_created: '그룹이 생성되었습니다!',
    success_found: '그룹을 찾았습니다!',
    success_joined: '그룹에 가입되었습니다!',
    success_copied: '초대 코드가 복사되었습니다!',
    role_owner: '소유자 (부모)',
    role_admin: '관리자 (부모)',
    role_member: '멤버 (아이 또는 가족 구성원)',
    no_groups: '가입한 그룹이 없습니다.',
    select_group: '그룹 선택',
    creating: '생성 중...',
    create_short: '생성',
    joining: '가입 중...',
    join_short: '가입',
  },
  en: {
    loading: 'Loading...',
    title: 'Family group setup',
    subtitle: 'Create a family group to get started',
    create_group: 'Create new group',
    join_invite: 'Join with invite code',
    first_member: 'Are you the first member?',
    already_family: 'Already have a family?',
    back: 'Back',
    group_name: 'Group name',
    group_name_placeholder: 'e.g. My Family',
    display_language: 'Display language',
    invite_code: 'Invite code',
    share_code_hint: 'Share this code with your family',
    confirm_invite_hint: '💡 You can find the invite code in Group settings in the admin page',
    confirmed_btn: 'I\'ve confirmed',
    go_to_dashboard: 'Go to family page',
    invite_join_subtitle: 'Enter the invite code from your family',
    invite_placeholder: 'e.g. ABC123',
    verify_btn: 'Verify',
    group_info: 'Group info',
    member_count: 'Members',
    member_count_suffix: ' members',
    join_btn: 'Join',
    copy_title: 'Copy',
    create_btn: 'Create group',
    error_init: 'An error occurred during initialization.',
    error_group_name_required: 'Please enter a group name.',
    error_login_required: 'Login required.',
    error_invite_code_failed: 'Failed to generate invite code.',
    error_invite_required: 'Please enter the invite code.',
    error_invalid_invite: 'Please enter a valid invite code.',
    error_verify_failed: 'Failed to verify invite code.',
    error_group_check: 'Please check the group info.',
    error_join_failed: 'Failed to join group.',
    error_copy_failed: 'Copy failed.',
    error_create_failed: 'Failed to create group.',
    success_created: 'Group created!',
    success_found: 'Group found!',
    success_joined: 'You have joined the group!',
    success_copied: 'Invite code copied!',
    role_owner: 'Owner (parent)',
    role_admin: 'Admin (parent)',
    role_member: 'Member (child or family)',
    no_groups: 'No groups yet.',
    select_group: 'Select group',
    creating: 'Creating...',
    create_short: 'Create',
    joining: 'Joining...',
    join_short: 'Join',
  },
  ja: {
    loading: '読み込み中...',
    title: 'ファミリーグループ設定',
    subtitle: '始める前にファミリーグループを作成してください',
    create_group: '新規グループ作成',
    join_invite: '招待コードで参加',
    first_member: '最初のメンバーですか？',
    already_family: 'すでにファミリーがありますか？',
    back: '戻る',
    group_name: 'グループ名',
    group_name_placeholder: '例: マイファミリー',
    display_language: '表示言語',
    invite_code: '招待コード',
    share_code_hint: 'このコードを家族と共有してください',
    confirm_invite_hint: '💡 招待コードは管理ページのグループ設定で確認できます',
    confirmed_btn: '確認しました',
    go_to_dashboard: 'ファミリーページへ',
    invite_join_subtitle: '家族から受け取った招待コードを入力してください',
    invite_placeholder: '例: ABC123',
    verify_btn: '確認',
    group_info: 'グループ情報',
    member_count: 'メンバー数',
    member_count_suffix: '人',
    join_btn: '参加する',
    copy_title: 'コピー',
    create_btn: 'グループ作成',
    error_init: '初期化中にエラーが発生しました。',
    error_group_name_required: 'グループ名を入力してください。',
    error_login_required: 'ログインが必要です。',
    error_invite_code_failed: '招待コードの生成に失敗しました。',
    error_invite_required: '招待コードを入力してください。',
    error_invalid_invite: '有効な招待コードを入力してください。',
    error_verify_failed: '招待コードの確認に失敗しました。',
    error_group_check: 'グループ情報を確認してください。',
    error_join_failed: 'グループの参加に失敗しました。',
    error_copy_failed: 'コピーに失敗しました。',
    error_create_failed: 'グループの作成に失敗しました。',
    success_created: 'グループが作成されました！',
    success_found: 'グループが見つかりました！',
    success_joined: 'グループに参加しました！',
    success_copied: '招待コードをコピーしました！',
    role_owner: 'オーナー（保護者）',
    role_admin: '管理者（保護者）',
    role_member: 'メンバー（子供または家族）',
    no_groups: '参加しているグループがありません。',
    select_group: 'グループを選択',
    creating: '作成中...',
    create_short: '作成',
    joining: '参加中...',
    join_short: '参加',
  },
  'zh-CN': {
    loading: '加载中...',
    title: '家庭群组设置',
    subtitle: '请先创建家庭群组',
    create_group: '创建新群组',
    join_invite: '邀请码加入',
    first_member: '您是第一位成员吗？',
    already_family: '已有家庭群组？',
    back: '返回',
    group_name: '群组名称',
    group_name_placeholder: '例如：我的家庭',
    display_language: '显示语言',
    invite_code: '邀请码',
    share_code_hint: '请将此码分享给家人',
    confirm_invite_hint: '💡 邀请码可在管理页的群组设置中查看',
    confirmed_btn: '已确认',
    go_to_dashboard: '进入家庭页面',
    invite_join_subtitle: '请输入家人提供的邀请码',
    invite_placeholder: '例如：ABC123',
    verify_btn: '验证',
    group_info: '群组信息',
    member_count: '成员数',
    member_count_suffix: '人',
    join_btn: '加入',
    copy_title: '复制',
    create_btn: '创建群组',
    error_init: '初始化时发生错误。',
    error_group_name_required: '请输入群组名称。',
    error_login_required: '请先登录。',
    error_invite_code_failed: '邀请码生成失败。',
    error_invite_required: '请输入邀请码。',
    error_invalid_invite: '请输入有效的邀请码。',
    error_verify_failed: '邀请码验证失败。',
    error_group_check: '请确认群组信息。',
    error_join_failed: '加入群组失败。',
    error_copy_failed: '复制失败。',
    error_create_failed: '创建群组失败。',
    success_created: '群组已创建！',
    success_found: '已找到群组！',
    success_joined: '已加入群组！',
    success_copied: '邀请码已复制！',
    role_owner: '所有者（家长）',
    role_admin: '管理员（家长）',
    role_member: '成员（孩子或家人）',
    no_groups: '暂无加入的群组。',
    select_group: '选择群组',
    creating: '创建中...',
    create_short: '创建',
    joining: '加入中...',
    join_short: '加入',
  },
  'zh-TW': {
    loading: '載入中...',
    title: '家庭群組設定',
    subtitle: '請先建立家庭群組',
    create_group: '建立新群組',
    join_invite: '邀請碼加入',
    first_member: '您是第一位成員嗎？',
    already_family: '已有家庭群組？',
    back: '返回',
    group_name: '群組名稱',
    group_name_placeholder: '例如：我的家庭',
    display_language: '顯示語言',
    invite_code: '邀請碼',
    share_code_hint: '請將此碼分享給家人',
    confirm_invite_hint: '💡 邀請碼可在管理頁的群組設定中查看',
    confirmed_btn: '已確認',
    go_to_dashboard: '前往家庭頁面',
    invite_join_subtitle: '請輸入家人提供的邀請碼',
    invite_placeholder: '例如：ABC123',
    verify_btn: '驗證',
    group_info: '群組資訊',
    member_count: '成員數',
    member_count_suffix: '人',
    join_btn: '加入',
    copy_title: '複製',
    create_btn: '建立群組',
    error_init: '初始化時發生錯誤。',
    error_group_name_required: '請輸入群組名稱。',
    error_login_required: '請先登入。',
    error_invite_code_failed: '邀請碼產生失敗。',
    error_invite_required: '請輸入邀請碼。',
    error_invalid_invite: '請輸入有效的邀請碼。',
    error_verify_failed: '邀請碼驗證失敗。',
    error_group_check: '請確認群組資訊。',
    error_join_failed: '加入群組失敗。',
    error_copy_failed: '複製失敗。',
    error_create_failed: '建立群組失敗。',
    success_created: '群組已建立！',
    success_found: '已找到群組！',
    success_joined: '已加入群組！',
    success_copied: '邀請碼已複製！',
    role_owner: '擁有者（家長）',
    role_admin: '管理員（家長）',
    role_member: '成員（孩子或家人）',
    no_groups: '尚無加入的群組。',
    select_group: '選擇群組',
    creating: '建立中...',
    create_short: '建立',
    joining: '加入中...',
    join_short: '加入',
  },
};

export function getOnboardingTranslation(lang: LangCode, key: keyof OnboardingTranslations): string {
  return onboarding[lang]?.[key] ?? onboarding.en[key] ?? (onboarding.ko[key] as string) ?? key;
}
