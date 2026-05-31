# ADR: Multi-Device Family Games Sessions

## Context

Family Games (ladder, RPS, roulette) previously stored all state in local React `useState` on one browser. One person could input for every participant. We need synchronized multiplayer within an authenticated family group.

## Decision

### Schema

- `family_game_sessions` — group-scoped session row (`game_type`, `status`, `phase`, `config` jsonb)
- `family_game_participants` — one row per player (`slot_index`, `ready`, public `payload`)
- `family_game_participant_secrets` — RPS choices; RLS allows **read/write only for `auth.uid() = user_id`**

Partial unique index enforces **one active session per group** (`status NOT IN ('completed','cancelled')`).

### Sync

- Primary: Supabase Realtime `postgres_changes` on `family_game_sessions` (filter `group_id`) and `family_game_participants` (filter `session_id`)
- Mutations: Next.js API routes with service role + `requireGroupMember` (consistent with piggy-bank pattern)
- Client hook: `useFamilyGameSession`

### Product defaults (documented)

| Question | Default |
|----------|---------|
| Destination labels | Host edits all in config; each participant may edit **own** slot label |
| Start / spin / ladder reveal | **Host only** (RPS auto-reveals when both submitted) |
| Concurrent sessions | **One active session per group** |

### Cheat prevention

- **Ladder:** `generateDenseLadderRungsSeeded(sessionId)` on server when host starts; user rungs merged from DB
- **RPS:** choices in `family_game_participant_secrets`; reveal copies choices into session `config` via API only
- **Roulette:** `pickRouletteIndex` + rotation computed once on server spin action

### Session lifecycle

- `expires_at` = 4 hours; stale sessions cancelled before new create
- Host may `cancel` → `status = cancelled`

## Manual test checklist (v1)

- [ ] Two phones, two members: host starts ladder → second device shows Join within ~2s
- [ ] RPS: A cannot see B's choice until both submitted; reveal syncs
- [ ] Ladder: each user draws at most one rung; progress `{done}/{total}` matches
- [ ] Roulette: all devices same rotation/winner after host spin
- [ ] Leave dashboard and return → session rehydrates from API
- [ ] Cancel session → new game can start
- [ ] Auth / tasks / chat widgets unchanged

## PR split suggestion

1. Schema + session CRUD + lobby/join (this foundation)
2. RPS multiplayer polish
3. Ladder multiplayer polish
4. Roulette multiplayer polish
