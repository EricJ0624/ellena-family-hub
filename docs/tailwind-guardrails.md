# Tailwind Guardrails

## Purpose
- Tailwind 통합 이후 인라인 스타일 회귀를 방지한다.
- 동적 예외는 허용하되, 무분별한 `style={{` 추가를 막는다.

## Rules
- 신규 `style={{` 추가 금지(원칙). 불가피하면 근거와 분류(A/B/C) 기록.
- 동적 예외는 `config/inline-style-allowlist.json`에 관리.
- 허용치 상향은 사유를 PR 설명에 명시.

## CI/Local Check
- 실행: `npm run check:inline-styles`
- 동작:
  - `app/**/*.tsx`의 `style={{` 개수 계산
  - allowlist 허용치 초과 시 실패

## Workflow
1. 변경 전 `npm run check:inline-styles` 실행
2. 스타일 리팩터링 진행
3. `npx tsc --noEmit`, `npm run lint`, `npm run check:inline-styles` 순으로 검증
4. 예외 항목 추가 시 `docs/tailwind-inline-style-classification.md` 업데이트

