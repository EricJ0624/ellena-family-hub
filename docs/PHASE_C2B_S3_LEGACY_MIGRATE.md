# Phase C-2b: 레거시 S3 키 → `apps/hearth_family`

## 상태

**실행 완료** (레거시 객체 삭제 포함)

| 단계 | 결과 |
|------|------|
| S3 CopyObject | 43 / 43 성공 |
| DB 키·URL 갱신 | album 23 · attachments 23 · scenes 1 |
| 레거시 S3 삭제 | **116** (twin 43 + orphan 73) — `originals/groups/` 잔여 0 |

매핑: `originals/groups/…` → `originals/apps/hearth_family/groups/…`

## 스크립트

```bash
node scripts/phase-c2b-migrate-s3-keys.mjs          # dry-run
node scripts/phase-c2b-migrate-s3-keys.mjs --execute

node scripts/phase-c2b-delete-legacy-s3.mjs         # dry-run (twins only)
node scripts/phase-c2b-delete-legacy-s3.mjs --execute --include-orphans
```
