# i18n 미적용 구간 정리

검색 기준: 사용자 노출 문자열(한글/영문), `alert`/`confirm`, placeholder, 버튼/라벨 텍스트.  
`console.error`/`console.log` 등 개발용 메시지는 제외.

---

## 1. Dashboard (`app/dashboard/page.tsx`) — **가장 많음**

### 1) 버튼/라벨 (UI 텍스트)
| 위치(대략) | 현재 문자열 | 제안 키 |
|------------|-------------|---------|
| Memories 섹션 업로드 버튼 | `Upload` | `photo_upload_btn` 또는 기존 `photo_add` |
| 캘린더 "오늘" 뱃지 | `오늘` | `event_today` |
| 위치 "어디야" 버튼 | `어디야` | `location_where_btn` (또는 `location_request_btn`) |
| 위치 "여기야" 버튼 | `여기야` | 기존 `location_share_btn` 사용 가능 → `dt('location_share_btn')` |
| 저금통 요청 카드 "거절"/"승인" 버튼 | `거절`, `승인` | `piggy_reject_btn`, `piggy_approve_btn` (또는 common `reject`/`approve`) |
| 위치 "✓ 이미 승인됨" | `✓ 이미 승인됨` | `location_already_approved` |
| 위치 "⏳ 요청 대기 중" | `⏳ 요청 대기 중` | `location_request_pending` |

### 2) alert / confirm 메시지 (한글 하드코딩)
- `유효하지 않은 월 형식입니다. JAN, FEB, MAR...`
- `일(day)은 1-31 사이의 숫자여야 합니다.`
- `삭제에 실패했습니다. 다시 시도해주세요.` (여러 곳)
- `일정 저장에 실패했습니다. 다시 시도해 주세요.`
- `작성자만 일정을 삭제할 수 있습니다.`
- `로그인이 필요합니다.` (여러 곳)
- `이 브라우저는 위치 서비스를 지원하지 않습니다.`
- `위치 추적이 중지되었습니다.`
- `위치 권한이 거부되었습니다. 브라우저 설정에서...`
- `위치 공유를 종료하시겠습니까?` (confirm)
- `인증 세션이 만료되었습니다. 다시 로그인해주세요.`
- `위치 공유가 종료되었습니다.`
- `위치 공유 종료 중 오류가 발생했습니다.`
- `위치를 공유했습니다!`
- `위치를 가져오는데 실패했습니다. 다시 시도해주세요.`
- `그룹 정보가 없습니다. 그룹을 선택한 후 다시 시도해주세요.`
- `위치 요청을 보냈습니다.`
- `위치 요청 전송 중 오류가 발생했습니다.`
- `위치 공유가 승인되었습니다.` / `위치 요청을 거부했습니다.` / `위치 요청을 취소했습니다.`
- `요청 처리 중 오류가 발생했습니다.`
- `인증 정보를 가져올 수 없습니다. 다시 로그인해주세요.`
- `로그아웃 하시겠습니까?` (confirm)
- `닉네임을 입력해주세요.` / `닉네임은 2자 이상 20자 이하로...`
- `닉네임이 업데이트되었습니다.`
- `할 일을 입력해주세요.` / `유효하지 않은 입력입니다.`
- `일정 제목을 입력해주세요.` / `날짜가 올바르지 않습니다.` / `유효하지 않은 제목입니다.`
- `지원하지 않는 파일 형식입니다...`
- `유효하지 않은 파일명입니다.`
- 업로드 관련: CORS/Cloudinary/S3 메시지 여러 개
- `이미지 처리 중 오류가 발생했습니다...`
- `파일 입력을 초기화할 수 없습니다. 페이지를 새로고침해주세요.`

→ 위 문구들은 `lib/translations/dashboard.ts`에 키 추가 후 `dt('...')` 로 치환하는 것이 좋습니다.

---

## 2. TitlePage / DesignEditor (`app/components/TitlePage.tsx`)

| 위치 | 현재 | 비고 |
|------|------|------|
| 오늘의 사진 `alt` | `alt="오늘의 추억"` | `titlePage` 또는 `common`에 `photo_alt_today_memory` 등 추가 |
| 폰트 선택 옵션 | `Inter (모던)`, `Roboto (깔끔)`, `Montserrat (강렬)` 등 | 폰트 라벨 i18n 시 `titlePage`에 `font_*` 키 추가하거나, 카테고리만 번역 |

---

## 3. PhotoFrames (`app/components/PhotoFrames.tsx`)

- `FRAME_CONFIGS` 내 `name` / `description`이 한글로 하드코딩되어 있음.
- **이미** `TitlePage`에서는 `tp('frame_baroque')` 등으로 표시하므로, UI 상 노출은 i18n 적용됨.
- `PhotoFrames`의 `name`/`description`은 다른 곳에서 참조하지 않으면 fallback/aria용으로만 남음. 필요 시 공통 번역으로 통일 가능.

---

## 4. Travel Planner (`app/modules/travel-planner/TravelPlannerContent.tsx`)

| 위치(대략) | 현재 | 비고 |
|------------|------|------|
| 지도/좌표 안내 문장 | `숙소·먹거리·일정에 위도/경도를 입력하면 지도에 표시됩니다. 파란색: 숙소...` | 한 줄 안내 문구 → travel 번역에 키 추가 |
| 라벨 | `위도`, `경도` | `label_lat`, `label_lng` 등 |
| placeholder | `placeholder="0"` | 숫자 입력용이면 그대로 두거나, 필요 시 `placeholder_number` 등 |

---

## 5. GroupSettings (`app/components/GroupSettings.tsx`)

- `setError('세션이 없습니다. 다시 로그인해 주세요.')` → 사용자 노출 메시지이므로 common 또는 groupSettings 번역 키로 i18n 적용 권장.

---

## 6. 기타 (참고)

- **Onboarding** (`app/onboarding/page.tsx`): `'사용자'` fallback 등 소수. 대부분 `console.error` 등 개발용.
- **Piggy-bank** (`app/piggy-bank/page.tsx`): `원`/`円`/`元` 등 통화 단위는 이미 `lang` 기준 분기되어 있음.
- **Admin** (`app/admin/page.tsx`): 이전 작업으로 대부분 적용됨. `console.error` 한글은 개발용이라 제외 가능.

---

## 권장 작업 순서

1. **Dashboard**  
   - `dashboard.ts`에 위 alert/confirm/버튼/라벨용 키 추가 (ko/en/ja/zh-CN/zh-TW).  
   - `dashboard/page.tsx`에서 해당 문자열을 `dt('...')` 로 교체.

2. **TitlePage**  
   - `오늘의 추억` alt, (선택) 폰트 라벨용 키 추가 후 교체.

3. **Travel Planner**  
   - 위도/경도 라벨 + 지도 안내 문구 번역 키 추가 후 교체.

4. **GroupSettings**  
   - 세션 에러 메시지 1건 번역 키로 교체.

원하시면 1번(Dashboard)부터 키 이름과 `dt(...)` 삽입 위치까지 구체적으로 적어드리겠습니다.
