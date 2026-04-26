# Naming Unification - Stage 2 Canonical Dictionary

목적: 앱에서 사용하는 기능 이름을 기준으로 파일/코드/API/DB 명칭을 통일하기 위한 단일 기준표를 정의한다.

연계 문서: `docs/NAMING_UNIFICATION_STAGE1_GATE.md`

## 1) 공통 규칙

- 앱 기능명/폴더/API path: kebab-case
  - 예: `family-chat`, `travel-planner`
- DB 테이블/컬럼: snake_case
  - 예: `family_chat_messages`, `travel_trips`
- 코드 심볼: PascalCase/camelCase
  - 예: `FamilyChatSection`, `useTravelTrips`
- DB 식별자에 하이픈(`-`) 사용 금지

## 2) Canonical 도메인 사전

| Domain ID | 앱 표시명 | 기능 폴더(기준) | API 경로(기준) | DB 네임스페이스(기준) |
|---|---|---|---|---|
| `family-chat` | Family Chat | `app/features/family-chat` | `/api/.../chat`(신규 시) | `family_chat_*` |
| `family-album` | Family Album | `app/features/family-album` | `/api/photos`, `/api/upload` | `family_album_*` |
| `attachments` | Attachments | `lib/feature-attachments-*` | `/api/attachments` | `attachments` 또는 `attachments_*` |
| `travel-planner` | Travel Planner | `app/features/travel-planner`, `app/modules/travel-planner` | `/api/v1/travel/*` | `travel_*` |
| `family-calendar` | Family Calendar | `app/features/family-calendar` | `/api/.../calendar`(신규 시) | `family_events` |
| `family-tasks` | Family Tasks | `app/features/family-tasks` | `/api/.../tasks`(신규 시) | `family_tasks` |
| `family-location` | Family Location | `app/features/family-location` | `/api/.../location`(신규 시) | `user_locations`, `location_requests` |
| `piggy-bank` | Piggy Bank | `app/features/piggy-bank` | `/api/piggy-bank/*` | `piggy_*` |

## 3) 불일치 항목과 목표 이름

## 3.1 High Priority (의미 불일치 큼)

| 현재 테이블 | 목표(논리명) | 물리 rename 우선순위 | 비고 |
|---|---|---|---|
| `memory_vault` | `family_album_items` | 낮음(즉시 금지) | 영향 범위 큼. 우선 코드 상수/호환 레이어로 전환 |
| `feature_attachments` | `attachments` | 중간 | API 명칭과 맞춤. 기존 `lib/feature-attachments-*` 명칭 정리 필요 |
| `family_messages` | `family_chat_messages` | 중간 | `family_chat`보다 엔티티 의미가 명확 |

## 3.2 Keep (현재 규칙 유지 권장)

| 현재 테이블 | 판단 |
|---|---|
| `travel_*` | 이미 도메인 규칙 일관됨 |
| `piggy_*` | 이미 도메인 규칙 일관됨 |
| `family_tasks`, `family_events` | 기능명과 의미적으로 합리적 |

## 4) modules vs features 기준 (구조 규칙 확정)

- `app/features/*`
  - 재사용 가능한 기능 조각(위젯/섹션/훅)
  - 대시보드/다른 화면에서 재사용 가능해야 함
- `app/modules/*`
  - 특정 페이지의 큰 조합물(화면 본체)
  - 여러 feature를 조합해 1개 화면 흐름을 구성
- 결론
  - `travel-planner`는 현재 구조 유지가 맞음
  - `modules`를 `features`로 단순 이름 변경하지 않음

## 5) 코드 상수 키 표준 (초안)

```ts
export const TABLES = {
  FAMILY_CHAT_MESSAGES: 'family_messages', // 단계적 전환 전 기존 물리명 유지
  FAMILY_ALBUM_ITEMS: 'memory_vault',      // 단계적 전환 전 기존 물리명 유지
  ATTACHMENTS: 'feature_attachments',      // 단계적 전환 전 기존 물리명 유지
} as const;
```

원칙:
- 단계 2에서는 “논리명”을 고정하고, “물리명”은 즉시 바꾸지 않는다.
- 실제 물리 rename은 영향도 분석/사전 승인/롤백 플랜 이후 단계에서만 수행한다.

## 6) 승인 게이트 (Stage 3 이전 필수)

아래 3개가 충족되어야 Stage 3(영향도 분석)로 진행:

1. 본 문서의 Canonical 이름에 대한 합의
2. High Priority 3개 항목에 대한 전환 순서 합의
3. `family_chat_messages` 명칭 채택 여부 확정

## 7) Decision Log

- 2026-04-26: DB 하이픈 표기(`family-chat`) 대신 snake_case 사용 원칙 확정
- 2026-04-26: `modules`와 `features`는 역할이 다르므로 공존 허용
