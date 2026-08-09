# 여행 일정 PDF — 결정 메모 & 단계 계획

**최종 합의 (2026-08):** HTML 한 템플릿 + **A안(Vercel 서버 Chromium → PDF + Noto 고정)**.  
기존 클라이언트 `pdf-lib`는 안정화 전 **fallback**. 장기 스케일은 **B안(PDF 워커 분리)** 으로 이사 가능(템플릿은 동일).

---

## 왜 한때 pdf-lib였나

- PDF 표준 폰트에 **한글 글리프 없음** → 폰트 바이트를 PDF에 **임베드**해야 함.
- 클라이언트 jsPDF CID 경로가 **모바일 Chrome** 등에서 빈 글자로 보이는 사례가 있어 `pdf-lib` + Noto 임베딩으로 전환함.
- 한글 깨짐은 “한국어만의 버그”가 아니라 **CJK + 클라이언트 PDF**의 전형적 실패 모드. 기업은 보통 **서버에서 폰트 고정**으로 해결.

## 왜 HTML + A안으로 가나

- 앱이 **Tailwind/CSS 통합**이라 PDF만 좌표 그리기로 두면 이질적.
- **미리보기 ≈ 인쇄 ≈ PDF**를 같은 `ItineraryDocument` HTML로 맞춤.
- 스크린샷 디자인(표지 / 개요·필수정보 / 상세 일차 카드) 구현에 HTML이 적합.
- 가족당 3–4명이면 동시 PDF는 낮음 → **A안(Vercel)으로 충분**, B는 신호 올 때.

## 스크린샷 문서 섹션

1. **표지** — 뱃지, 제목, 서브타이틀, 기간/여행자/테마 카드  
2. **개요** — 항공·호텔 / 긴급 연락처 / 준비물 체크리스트  
3. **상세 일정** — Day N 카드, 코랄 시간, 제목, 설명  

지도·표지 이미지는 이번 범위 제외.

## 위젯에 추가한 메타 (스크린샷용)

- `cover_badge`, `subtitle`, `theme`, `travelers_text`, `flight_summary`
- `emergency_contacts` JSONB, `packing_checklist` JSONB
- `travel_day_titles` (일차별 제목)

박·일은 `start_date`/`end_date`로 계산.

## A → B 이사 신호

동시 Chromium·타임아웃·콜드스타트·비용이 반복되면 **같은 HTML 템플릿**을 워커로만 옮긴다.  
가입자 수보다 **PDF p95 / 에러율 / 동시 생성**이 기준.

## 구현 Phase (코드)

| Phase | 내용 |
|-------|------|
| 0 | 이 문서 |
| 1 | 스키마 + 위젯 입력 |
| 2 | `ItineraryDocument` + 미리보기/print |
| 3 | Vercel PDF API + Noto + fallback |
| 4 | 항공 요약·빈 섹션·다듬기 |

## Fallback

[`lib/modules/travel-planner/itinerary-pdf.ts`](../lib/modules/travel-planner/itinerary-pdf.ts) — 서버 PDF 실패 시 클라이언트 pdf-lib 유지.
