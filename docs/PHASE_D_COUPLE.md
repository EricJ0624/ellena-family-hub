# Phase D+ — Hearth 멀티 앱 (4종)

## 확정 app_id · 폴더 · 도메인

| # | 제품 | `app_id` | 폴더 | 로컬 | 도메인 |
|---|------|----------|------|------|--------|
| 1 | Hearth Family | `hearth_family` | `ellena-family-hub` | 3000 | `www.myhearthfamily.com` |
| 2 | Hearth Couple | `hearth_couple` | `../hearth-couple` | 3001 | `couple.myhearthfamily.com` |
| 3 | Hearth Biker | `hearth_biker` | `../hearth-biker` | 3002 | `biker.myhearthfamily.com` |
| 4 | Hearth Camper | `hearth_camper` | `../hearth-camper` | 3003 | `camper.myhearthfamily.com` |

## 격리

- DB RLS: 4개 `app_id` 허용
- 배포별 `NEXT_PUBLIC_APP_ID` + 클라/API 필터
- S3: `originals/apps/{app_id}/…`
- Vercel: 앱당 프로젝트 권장
- Auth Redirect URLs: 앱 도메인 + 로컬 포트 콜백

## D-1 (완료)

원격 RLS + `CURRENT_APP_ID` 필터

## D-2 Couple (스캐폴드 완료)

- [x] 폴더·포트 3001·브랜드
- [ ] Vercel + DNS — `docs/VERCEL_DNS_MULTI_APP.md` / `scripts/setup-vercel-multi-app.ps1` (`vercel login` 필요)
- [ ] 격리 수동 검증 (Google 포함)

## D-3 Biker / D-4 Camper (스캐폴드 완료)

- [x] `hearth-biker` 포트 3002, `hearth_biker`
- [x] `hearth-camper` 포트 3003, `hearth_camper`
- [ ] Redirect: `http://localhost:3002|3003/auth/callback` (+ reset-password)
- [x] `npm install`
- [ ] Vercel + DNS (위 가이드와 동일)

## 타이틀 워딩

`Hearth: Family` / `Couple` / `Biker` / `Camper` (Haven 제거, 기존 글자 계층 유지)
