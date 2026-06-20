/** 이용약관·개인정보 처리방침 본문 (ko / en) */

export const LEGAL_LAST_UPDATED = '2026-06-20';

export const TERMS_TITLE = { ko: '이용약관', en: 'Terms of Service' } as const;
export const PRIVACY_TITLE = { ko: '개인정보 처리방침', en: 'Privacy Policy' } as const;

export const TERMS_BODY = {
  ko: `제1조 (목적)
본 약관은 Hearth: Family Haven(이하 "서비스")의 이용 조건과 절차를 정합니다.

제2조 (서비스)
서비스는 가족·그룹 단위의 일정, 앨범, 채팅 등 협업 기능을 제공합니다.

제3조 (회원 가입)
1. 이용자는 정확한 정보로 가입해야 합니다.
2. 가입 시 표시 언어·거주 국가를 선택합니다. 이는 서비스 제공·운영 통계에 사용됩니다.
3. 이메일 인증 등 본 서비스가 정한 절차를 따라야 합니다.

제4조 (이용자 의무)
이용자는 타인의 권리를 침해하거나 불법·유해 콘텐츠를 게시해서는 안 됩니다.

제5조 (서비스 변경·중단)
운영상 필요 시 서비스의 전부 또는 일부를 변경·중단할 수 있습니다.

제6조 (면책)
천재지변, 통신 장애 등 불가항력으로 인한 손해에 대해 법령이 허용하는 범위에서 책임을 제한할 수 있습니다.

제7조 (문의)
서비스 관련 문의는 앱 내 고객 지원·문의 기능을 이용해 주세요.`,
  en: `Article 1 (Purpose)
These Terms govern your use of Hearth: Family Haven (the "Service").

Article 2 (Service)
The Service provides family/group collaboration features such as calendar, albums, and chat.

Article 3 (Registration)
1. You must register with accurate information.
2. At sign-up you choose a display language and country of residence for service delivery and aggregated statistics.
3. You must complete verification steps required by the Service.

Article 4 (User obligations)
You must not infringe others' rights or post illegal or harmful content.

Article 5 (Changes and suspension)
We may modify or suspend all or part of the Service when reasonably necessary.

Article 6 (Limitation of liability)
To the extent permitted by law, we limit liability for failures due to force majeure or network issues.

Article 7 (Contact)
Use in-app support or inquiry features for questions about the Service.`,
} as const;

export const PRIVACY_BODY = {
  ko: `1. 수집 항목
- 필수: 이메일, 비밀번호(암호화 저장), 닉네임, 표시 언어(preferred_language), 거주 국가(country_code)
- 선택·서비스 이용 과정: 프로필 이미지, 가족 역할, 그룹 활동 데이터(일정, 사진, 채팅 등)

2. 수집 목적
- 회원 식별·인증, 서비스 제공·개인화(표시 언어·지역 맞춤)
- 고객 지원, 보안·부정 이용 방지
- 익명화·집계된 운영 통계(언어·국가 분포 등)

3. 보관 기간
- 회원 탈퇴 시 관련 법령 및 내부 정책에 따라 지체 없이 파기하거나 분리 보관합니다.

4. 이용자 권리
- 대시보드 「내 계정」에서 표시 언어·거주 국가를 변경할 수 있습니다.
- 열람·정정·삭제·처리 정지 요청은 문의 기능으로 요청할 수 있습니다.

5. 제3자 제공
- 법령에 따른 경우를 제외하고, 동의 없이 개인정보를 제3자에게 제공하지 않습니다.

6. 처리 위탁
- 인프라(호스팅·DB 등) 제공을 위해 클라우드 사업자에 처리를 위탁할 수 있으며, 계약을 통해 안전하게 관리합니다.

7. 문의
- 개인정보 관련 문의는 앱 내 문의·지원 채널을 이용해 주세요.`,
  en: `1. Data we collect
- Required: email, password (stored encrypted), nickname, display language (preferred_language), country of residence (country_code)
- Optional / during use: profile image, family role, group activity data (calendar, photos, chat, etc.)

2. Purposes
- Account identification and authentication; personalized service (language and region)
- Customer support; security and abuse prevention
- Aggregated operational statistics (e.g. language and country distribution)

3. Retention
- Upon account deletion, we delete or segregate data without undue delay per applicable law and internal policy.

4. Your rights
- Change display language and country in Dashboard → My Account.
- Request access, correction, deletion, or restriction via in-app inquiry/support.

5. Third-party disclosure
- We do not disclose personal data to third parties without consent except as required by law.

6. Processors
- We may use cloud providers for hosting and databases under contractual safeguards.

7. Contact
- For privacy questions, use in-app support or inquiry channels.`,
} as const;

export function pickLegalLocale(lang: string): 'ko' | 'en' {
  return lang === 'ko' ? 'ko' : 'en';
}
