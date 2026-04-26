# Tailwind Token Mapping (Stage 3)

## Added Semantic Tokens
- `brand.primary` -> `--brand-primary`
- `brand.secondary` -> `--brand-secondary`
- `brand.accent` -> `--brand-accent`
- `surface.base` -> `--surface-base`
- `surface.elevated` -> `--surface-elevated`
- `surface.muted` -> `--surface-muted`

## Variable Definitions
- 파일: `app/globals.css`
- light/dark 각각 값 정의
- 기존 `primary`, `accent`, `background` 변수는 유지(하위호환)

## Migration Guidance
- 임의 hex/rgba 대신 우선순위로 치환
  1. 브랜드 계열 색: `brand.*`
  2. 배경/카드 계열: `surface.*`
  3. 상태성 색: 기존 `primary`, `muted`, `destructive` 활용

## Example
- Before: `bg-[linear-gradient(135deg,#667eea_0%,#764ba2_100%)]`
- After (권장): 토큰 기반 utility 조합 또는 CSS 변수 기반 gradient class

