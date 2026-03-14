import type { LangCode } from '@/lib/language-fonts';

type LoginTranslations = {
  subtitle: string;
  tab_login: string;
  tab_signup: string;
  tab_forgot: string;
  keep_logged_in: string;
  placeholder_nickname: string;
  placeholder_email: string;
  placeholder_password: string;
  placeholder_confirm_password: string;
  btn_loading_login: string;
  btn_loading_signup: string;
  btn_loading_send: string;
  btn_submit_login: string;
  btn_submit_signup: string;
  btn_submit_reset: string;
  error_email_verification: string;
  error_session_failed: string;
  error_login_failed: string;
  error_password_mismatch: string;
  error_password_min: string;
  error_nickname_required: string;
  error_nickname_length: string;
  error_email_taken: string;
  error_signup_failed: string;
  error_send_failed: string;
  success_signup_check_email: string;
  success_signup_done: string;
  success_signup_optional: string;
  success_reset_sent: string;
};

const login: Record<LangCode, LoginTranslations> = {
  ko: {
    subtitle: '우리가족 추억의 공간',
    tab_login: '로그인',
    tab_signup: '가입하기',
    tab_forgot: '비밀번호 찾기',
    keep_logged_in: '로그인 상태 유지',
    placeholder_nickname: '별명 (필수, 2~20자)',
    placeholder_email: '이메일 주소',
    placeholder_password: '비밀번호',
    placeholder_confirm_password: '비밀번호 확인',
    btn_loading_login: '접속 중',
    btn_loading_signup: '가입 중',
    btn_loading_send: '발송 중',
    btn_submit_login: '접속하기',
    btn_submit_signup: '가입하기',
    btn_submit_reset: '재설정 링크 발송',
    error_email_verification: '이메일 인증이 필요합니다. 메일함에서 인증을 완료해주세요.',
    error_session_failed: '세션 저장에 실패했습니다. 다시 시도해주세요.',
    error_login_failed: '로그인 실패: 정보를 확인해주세요.',
    error_password_mismatch: '비밀번호가 일치하지 않습니다.',
    error_password_min: '비밀번호는 최소 8자 이상이어야 합니다.',
    error_nickname_required: '별명을 입력해 주세요.',
    error_nickname_length: '별명은 2자 이상 20자 이하로 입력해 주세요.',
    error_email_taken: '이미 등록된 이메일입니다.',
    error_signup_failed: '가입 실패: 정보를 확인해주세요.',
    error_send_failed: '이메일 발송 실패: 이메일을 확인해주세요.',
    success_signup_check_email: '가입이 완료되었습니다! 이메일을 확인하고 인증을 완료해주세요.',
    success_signup_done: '가입이 완료되었습니다! 이메일을 확인해주세요. (이메일 인증이 설정된 경우)',
    success_signup_optional: '가입이 완료되었습니다! 이메일을 확인해주세요.',
    success_reset_sent: '비밀번호 재설정 링크를 이메일로 발송했습니다. 이메일을 확인해주세요.',
  },
  en: {
    subtitle: "A space for our family",
    tab_login: 'Login',
    tab_signup: 'Sign up',
    tab_forgot: 'Forgot password',
    keep_logged_in: 'Keep me logged in',
    placeholder_nickname: 'Nickname (required, 2-20 characters)',
    placeholder_email: 'Email address',
    placeholder_password: 'Password',
    placeholder_confirm_password: 'Confirm password',
    btn_loading_login: 'Signing in...',
    btn_loading_signup: 'Signing up...',
    btn_loading_send: 'Sending...',
    btn_submit_login: 'Sign in',
    btn_submit_signup: 'Sign up',
    btn_submit_reset: 'Send reset link',
    error_email_verification: 'Email verification required. Please verify in your inbox.',
    error_session_failed: 'Failed to save session. Please try again.',
    error_login_failed: 'Login failed. Please check your information.',
    error_password_mismatch: 'Passwords do not match.',
    error_password_min: 'Password must be at least 8 characters.',
    error_nickname_required: 'Please enter a nickname.',
    error_nickname_length: 'Nickname must be 2 to 20 characters.',
    error_email_taken: 'This email is already registered.',
    error_signup_failed: 'Sign up failed. Please check your information.',
    error_send_failed: 'Failed to send email. Please check the address.',
    success_signup_check_email: 'Sign up complete! Please check your email and verify.',
    success_signup_done: 'Sign up complete! Please check your email. (if verification is enabled)',
    success_signup_optional: 'Sign up complete! Please check your email.',
    success_reset_sent: 'Password reset link has been sent. Please check your email.',
  },
  ja: {
    subtitle: '家族の思い出の場所',
    tab_login: 'ログイン',
    tab_signup: '新規登録',
    tab_forgot: 'パスワードを忘れた',
    keep_logged_in: 'ログイン状態を保持',
    placeholder_nickname: 'ニックネーム（必須、2〜20文字）',
    placeholder_email: 'メールアドレス',
    placeholder_password: 'パスワード',
    placeholder_confirm_password: 'パスワード（確認）',
    btn_loading_login: '接続中...',
    btn_loading_signup: '登録中...',
    btn_loading_send: '送信中...',
    btn_submit_login: 'ログイン',
    btn_submit_signup: '登録する',
    btn_submit_reset: 'リセットリンクを送信',
    error_email_verification: 'メール認証が必要です。受信トレイで認証を完了してください。',
    error_session_failed: 'セッションの保存に失敗しました。もう一度お試しください。',
    error_login_failed: 'ログインに失敗しました。情報を確認してください。',
    error_password_mismatch: 'パスワードが一致しません。',
    error_password_min: 'パスワードは8文字以上で入力してください。',
    error_nickname_required: 'ニックネームを入力してください。',
    error_nickname_length: 'ニックネームは2〜20文字で入力してください。',
    error_email_taken: 'このメールアドレスは既に登録されています。',
    error_signup_failed: '登録に失敗しました。情報を確認してください。',
    error_send_failed: '送信に失敗しました。メールアドレスを確認してください。',
    success_signup_check_email: '登録が完了しました！メールを確認して認証を完了してください。',
    success_signup_done: '登録が完了しました！メールを確認してください。（認証が有効な場合）',
    success_signup_optional: '登録が完了しました！メールを確認してください。',
    success_reset_sent: 'パスワードリセットリンクを送信しました。メールを確認してください。',
  },
  'zh-CN': {
    subtitle: '我们家的回忆角落',
    tab_login: '登录',
    tab_signup: '注册',
    tab_forgot: '忘记密码',
    keep_logged_in: '保持登录状态',
    placeholder_nickname: '昵称（必填，2-20字）',
    placeholder_email: '邮箱地址',
    placeholder_password: '密码',
    placeholder_confirm_password: '确认密码',
    btn_loading_login: '登录中...',
    btn_loading_signup: '注册中...',
    btn_loading_send: '发送中...',
    btn_submit_login: '登录',
    btn_submit_signup: '注册',
    btn_submit_reset: '发送重置链接',
    error_email_verification: '请先完成邮箱验证。请在收件箱中完成验证。',
    error_session_failed: '会话保存失败，请重试。',
    error_login_failed: '登录失败，请检查信息。',
    error_password_mismatch: '两次输入的密码不一致。',
    error_password_min: '密码至少需要8个字符。',
    error_nickname_required: '请输入昵称。',
    error_nickname_length: '昵称需为2至20个字符。',
    error_email_taken: '该邮箱已被注册。',
    error_signup_failed: '注册失败，请检查信息。',
    error_send_failed: '发送失败，请检查邮箱地址。',
    success_signup_check_email: '注册完成！请查收邮件并完成验证。',
    success_signup_done: '注册完成！请查收邮件。（如已开启邮箱验证）',
    success_signup_optional: '注册完成！请查收邮件。',
    success_reset_sent: '已发送密码重置链接，请查收邮件。',
  },
  'zh-TW': {
    subtitle: '我們家的回憶角落',
    tab_login: '登入',
    tab_signup: '註冊',
    tab_forgot: '忘記密碼',
    keep_logged_in: '保持登入狀態',
    placeholder_nickname: '暱稱（必填，2-20字）',
    placeholder_email: '電子郵件地址',
    placeholder_password: '密碼',
    placeholder_confirm_password: '確認密碼',
    btn_loading_login: '登入中...',
    btn_loading_signup: '註冊中...',
    btn_loading_send: '發送中...',
    btn_submit_login: '登入',
    btn_submit_signup: '註冊',
    btn_submit_reset: '發送重設連結',
    error_email_verification: '請先完成電子郵件驗證。請在收件匣中完成驗證。',
    error_session_failed: '工作階段儲存失敗，請重試。',
    error_login_failed: '登入失敗，請檢查資訊。',
    error_password_mismatch: '兩次輸入的密碼不一致。',
    error_password_min: '密碼至少需要8個字元。',
    error_nickname_required: '請輸入暱稱。',
    error_nickname_length: '暱稱需為2至20個字元。',
    error_email_taken: '該電子郵件已被註冊。',
    error_signup_failed: '註冊失敗，請檢查資訊。',
    error_send_failed: '發送失敗，請檢查電子郵件地址。',
    success_signup_check_email: '註冊完成！請查收郵件並完成驗證。',
    success_signup_done: '註冊完成！請查收郵件。（如已開啟郵件驗證）',
    success_signup_optional: '註冊完成！請查收郵件。',
    success_reset_sent: '已發送密碼重設連結，請查收郵件。',
  },
};

export function getLoginTranslation(lang: LangCode, key: keyof LoginTranslations): string {
  return login[lang]?.[key] ?? login.en[key] ?? (login.ko[key] as string) ?? key;
}

export type { LoginTranslations };
