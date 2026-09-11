# Vercel + DNS — 4앱 배포 체크리스트

Family 기존 프로젝트: `ellena-family-hub` (`prj_XjjY13XWdPirDVtOAPvsjSM2PupI`)

| 앱 | 로컬 폴더 | Vercel 프로젝트명(권장) | 도메인 | APP_ID |
|----|-----------|-------------------------|--------|--------|
| Family | `ellena-family-hub` | `ellena-family-hub` (기존) | `www.myhearthfamily.com` | `hearth_family` |
| Couple | `hearth-couple` | `hearth-couple` | `couple.myhearthfamily.com` | `hearth_couple` |
| Biker | `hearth-biker` | `hearth-biker` | `biker.myhearthfamily.com` | `hearth_biker` |
| Camper | `hearth-camper` | `hearth-camper` | `camper.myhearthfamily.com` | `hearth_camper` |

## 0) 선행 (에이전트가 CLI로 진행하려면)

터미널에서 로그인 후 다시 요청:

```bash
vercel login
```

또는 Vercel → Settings → Tokens 에서 토큰 발급 후:

```powershell
$env:VERCEL_TOKEN = "...."
```

## 1) Vercel 프로젝트 (앱당 1개)

각 폴더에서 (예시 Couple):

```bash
cd c:\Dev\ellena-family-app-next.js\hearth-couple
vercel link --yes --project hearth-couple
# 또는 신규: vercel project add hearth-couple 후 link
vercel domains add couple.myhearthfamily.com
```

Biker / Camper도 동일하게 `hearth-biker` + `biker.myhearthfamily.com`, `hearth-camper` + `camper.myhearthfamily.com`.

### 필수 env (Vercel Project → Settings → Environment Variables)

Family와 **같은** Supabase/AWS 키를 넣고, 아래만 앱별로 다르게:

- `NEXT_PUBLIC_APP_ID` = `hearth_couple` | `hearth_biker` | `hearth_camper`
- `APP_ID` = (위와 동일)

그 외 Family에 있는 `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, AWS/S3/CloudFront 등은 복사.

## 2) DNS (도메인 관리처 — Cloudflare/가비아 등)

Vercel 도메인 추가 후 안내에 나오는 값을 쓰되, 일반적으로:

| Type | Name | Value |
|------|------|--------|
| CNAME | `couple` | `cname.vercel-dns.com` (또는 Vercel이 준 타깃) |
| CNAME | `biker` | (동일 패턴) |
| CNAME | `camper` | (동일 패턴) |

`www` / apex는 Family 프로젝트에 유지.

프록시(Cloudflare orange cloud)를 쓰면 SSL/캐시 이슈가 날 수 있어, 처음엔 **DNS only** 권장.

## 3) Supabase Auth (이미 한 것)

Redirect URLs에 이미 있음:

- `https://couple.myhearthfamily.com/auth/callback` (+ reset-password)
- biker / camper 동일
- 로컬 3001 콜백

로컬 3002·3003도 Google 테스트 시 추가:

- `http://localhost:3002/auth/callback`
- `http://localhost:3003/auth/callback`

## 4) 배포

```bash
cd hearth-couple
vercel --prod
```

첫 배포 후 `https://couple.myhearthfamily.com` 접속 → 로그인 → Couple 그룹만 보여야 함.
