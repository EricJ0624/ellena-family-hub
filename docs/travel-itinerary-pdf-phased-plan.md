# 여행 일정 PDF — 단계별 적용 계획 (WIP 체크포인트)

**진행 상황:** Phase 1·2·3·4 적용됨 — 표지(1p) → **일정 요약**(2p, 일차별 한 줄·카드형) → **상세**(3p~) · Noto **Bold** 보조 임베딩 · 표지에 **경비 요약** 3줄(총예산·지출합·잔액). 지도/QR은 미포함(정책·용량). 폰트: Regular/Bold subset OTF CDN 또는 `public/fonts/`.

---

과거 기준: PDF가 컴포넌트 내 **jsPDF + Helvetica**만 쓰면 한글이 깨지거나 레이아웃이 빈약할 수 있다. 아래는 **작은 PR/커밋 단위**로 나눈 구체 계획이다.

## Phase 1 — 한글 폰트 + 코드 분리 (기능 동일)

- **목표**: PDF에 한글이 안정적으로 출력되도록 **커스텀 폰트 임베딩**, 생성 로직은 한 파일로 모음.
- **구현 요지**:
  - `lib/modules/travel-planner/itinerary-pdf.ts`(명칭 예시)로 `downloadItineraryPdf` 본문 이전.
  - `doc.addFileToVFS(파일명, base64문자열)` 후 `doc.addFont(파일명, 'NotoSansKR', 'normal', 'Identity-H')` 패턴(jsPDF 2.5 TTF 플러그인: VFS 내용은 **base64** 또는 TTF 매직 네임바이너리 문자열).
  - 폰트 소스(택일):
    - **권장**: `public/fonts/NotoSansKR-Regular.otf`(또는 TTF) 정적 배포 + `fetch` 후 base64 변환. **첫 생성 후 메모리 캐시**로 재다운로드 방지.
    - Subset KR OTF는 약 4~5MB 수준(notofonts/noto-cjk `Sans/SubsetOTF/KR/NotoSansKR-Regular.otf`) — 네트워크 한 번은 감수하거나 빌드 시 `public`에 복사.
  - 폰트 로드 실패 시 **기존 Helvetica**로 저장(회귀 방지), 개발 환경에서만 `console.warn`.
- **검증**: 한글 제목·일정·라벨·설명이 PDF에서 정상 표시; 빈 일정·긴 설명 줄바꿈 기존과 동일.

## Phase 2 — 1페이지 브로슈어형 표지 (여행사 느낌 시작)

- **목표**: 첫 페이지를 **표지**로: 여행명, 목적지, 기간, 얇은 **브랜드 컬러 박스/헤더 바**, 하단 작은 문구(예: 그룹명은 선택).
- **구현 요지**: jsPDF `setFillColor`, `rect`, `line`, `setFont`/`setFontSize`만 사용 (Tailwind 미적용).
- **검증**: 1페이지만 봐도 정보 계층이 읽힘; A4 세로 기준 여백 일정.

## Phase 3 — 2페이지 요약 + 이후 본문

- **목표**: **2페이지 이내**에 “요약 브로슈어”: 일차별 **한 줄 요약** 또는 첫 N일만 카드/타임라인 스타일, 나머지 일정은 3페이지부터 기존처럼 리스트(또는 동일 스타일 연속).
- **구현 요지**: `sortedItineraries`를 일자별 그룹핑(현재와 동일) 후, `y`/`addPage` 임계값 조정; 표지용 상수(색, margin)는 파일 상단 한곳.
- **검증**: 일정 많을 때 페이지 넘김·겹침 없음; 1~2일 짧은 여행은 1~2페이지로 끝나는지.

## Phase 4 — (선택) 볼드 체·지도/QR·비용 요약

- 볼드: 같은 폰트 패밀리 **Bold 파일** 추가 VFS 또는 Medium만 사용.
- 지도/QR: `addImage` + 외부 URL/스냅샷은 정책·용량 검토 후.

## 기술 메모

- **@fontsource/noto-sans-kr**: 웹용 **woff2 분할** 위주라 jsPDF VFS TTF 파이프와 맞지 않음(직접 임베딩 소스로는 비권장).
- **HTML+Tailwind → PDF**는 별도 노선(인쇄 전용 라우트 등); 본 계획은 jsPDF 유지 전제.

## 다음 세션에서 할 첫 작업

1. `TravelPlannerContent.tsx`에서 `downloadItineraryPdf` 콜백 본문을 `buildTravelItineraryPdf(...)` 같은 함수로 분리.
2. `public/fonts/`에 KR subset OTF/TTF 배치(또는 스크립트로 복사) 후 Phase 1 폰트 등록 + `setFont` 교체.

이 문서는 배터리/중단 시점의 **진행 저장용**이며, 구현 착수 시 위 순서대로 커밋을 쪼개면 된다.
