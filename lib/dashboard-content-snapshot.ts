/**
 * 대시보드 마지막 성공 내용.
 * 재방문 시 서버 응답 전에 같은 그룹 내용만 먼저 그린다.
 * 일정·할 일만 localStorage에 남긴다.
 * 앨범·채팅·저금통은 같은 탭 메모리에만 둔다(저금통 화면을 나갔다 들어올 때 빈 칸을 막기 위함).
 * 다른 그룹 스냅샷은 키에 groupId가 있어 섞이지 않는다.
 */
import type { FamilyEvent } from '@/app/features/family-calendar/types';
import type { FamilyTask } from '@/app/features/family-tasks/types';
import type { AccountRequest, PiggyMemberOrAccount, PiggySummary } from '@/app/features/piggy-bank/types';
import type { ChatUiMessage } from '@/lib/chat-messages';
import { CryptoService } from '@/lib/dashboard-storage';

const STORAGE_PREFIX = 'SFH_WIDGET_CONTENT_v1_';
const MAX_VISIT_MESSAGES = 50;
const MAX_VISIT_ALBUM = 80;

export type DashboardAlbumSnapshotItem = {
  id: number | string;
  data: string;
  supabaseId?: string | number;
  isUploaded?: boolean;
  isUploading?: boolean;
  description?: string;
  originalFilename?: string;
  mimeType?: string;
  created_by?: string;
};

/** 저금통 위젯이 마지막으로 그린 요약. null이면 아직 한 번도 받지 않음. */
export type DashboardPiggySnapshot = {
  summary: PiggySummary | null;
  memberPiggies: PiggyMemberOrAccount[] | null;
  pendingAccountRequests: AccountRequest[];
};

export type DashboardContentSnapshot = {
  todos: FamilyTask[];
  events: FamilyEvent[];
  album: DashboardAlbumSnapshotItem[];
  messages: ChatUiMessage[];
  piggy: DashboardPiggySnapshot | null;
};

const memory = new Map<string, DashboardContentSnapshot>();

function storageKey(userId: string, groupId: string): string {
  return `${STORAGE_PREFIX}${userId}_${groupId}`;
}

function isRepeatType(value: unknown): value is NonNullable<FamilyEvent['repeat_type']> {
  return value === 'none' || value === 'monthly' || value === 'yearly';
}

function sanitizeTasks(raw: unknown): FamilyTask[] {
  if (!Array.isArray(raw)) return [];
  const tasks: FamilyTask[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Partial<FamilyTask>;
    if (row.id == null || typeof row.text !== 'string') continue;
    tasks.push({
      id: row.id,
      text: row.text,
      assignee: typeof row.assignee === 'string' ? row.assignee : '',
      done: row.done === true,
      created_by: typeof row.created_by === 'string' ? row.created_by : undefined,
      assigned_to_user_id:
        typeof row.assigned_to_user_id === 'string' ? row.assigned_to_user_id : undefined,
      supabaseId: row.supabaseId,
    });
  }
  return tasks;
}

function sanitizeEvents(raw: unknown): FamilyEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: FamilyEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Partial<FamilyEvent>;
    if (row.id == null || typeof row.title !== 'string' || typeof row.event_date !== 'string') continue;
    events.push({
      id: row.id,
      month: typeof row.month === 'string' ? row.month : '',
      day: typeof row.day === 'string' ? row.day : '',
      title: row.title,
      desc: typeof row.desc === 'string' ? row.desc : '',
      event_date: row.event_date,
      end_date: typeof row.end_date === 'string' ? row.end_date : undefined,
      created_by: typeof row.created_by === 'string' ? row.created_by : undefined,
      created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
      supabaseId: row.supabaseId,
      repeat_type: isRepeatType(row.repeat_type) ? row.repeat_type : 'none',
    });
  }
  return events;
}

function isHttpPhotoUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/api/photo/proxy') || value.startsWith('/api/media/file');
}

function sanitizeAlbum(raw: unknown): DashboardAlbumSnapshotItem[] {
  if (!Array.isArray(raw)) return [];
  const photos: DashboardAlbumSnapshotItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Partial<DashboardAlbumSnapshotItem>;
    if ((typeof row.id !== 'string' && typeof row.id !== 'number') || typeof row.data !== 'string') continue;
    if (!isHttpPhotoUrl(row.data)) continue;
    photos.push({
      id: row.id,
      data: row.data,
      supabaseId: typeof row.supabaseId === 'string' || typeof row.supabaseId === 'number' ? row.supabaseId : undefined,
      isUploaded: row.isUploaded === true,
      isUploading: false,
      description: typeof row.description === 'string' ? row.description : '',
      originalFilename: typeof row.originalFilename === 'string' ? row.originalFilename : undefined,
      mimeType: typeof row.mimeType === 'string' ? row.mimeType : undefined,
      created_by: typeof row.created_by === 'string' ? row.created_by : undefined,
    });
    if (photos.length >= MAX_VISIT_ALBUM) break;
  }
  return photos;
}

function sanitizeMessages(raw: unknown): ChatUiMessage[] {
  if (!Array.isArray(raw)) return [];
  const messages: ChatUiMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Partial<ChatUiMessage>;
    if (typeof row.id !== 'string' || typeof row.text !== 'string') continue;
    messages.push({
      id: row.id,
      user: typeof row.user === 'string' ? row.user : '사용자',
      text: row.text,
      time: typeof row.time === 'string' ? row.time : '',
      sender_id: typeof row.sender_id === 'string' ? row.sender_id : undefined,
      created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
    });
  }
  if (messages.length <= MAX_VISIT_MESSAGES) return messages;
  return messages.slice(messages.length - MAX_VISIT_MESSAGES);
}

function sanitizePiggyMember(raw: unknown): PiggyMemberOrAccount | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as {
    user_id?: unknown;
    ownerNickname?: unknown;
    noAccount?: unknown;
    id?: unknown;
    name?: unknown;
    balance?: unknown;
    walletBalance?: unknown;
    currency?: unknown;
  };
  const ownerNickname = typeof row.ownerNickname === 'string' || row.ownerNickname === null
    ? row.ownerNickname
    : null;
  if (row.noAccount === true) {
    if (typeof row.user_id !== 'string') return null;
    return { user_id: row.user_id, ownerNickname, noAccount: true };
  }
  if (typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.balance !== 'number') return null;
  return {
    id: row.id,
    user_id: typeof row.user_id === 'string' ? row.user_id : null,
    ownerNickname,
    name: row.name,
    balance: row.balance,
    walletBalance: typeof row.walletBalance === 'number' ? row.walletBalance : 0,
    currency: typeof row.currency === 'string' ? row.currency : undefined,
    noAccount: false,
  };
}

function sanitizePiggy(raw: unknown): DashboardPiggySnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Partial<DashboardPiggySnapshot>;
  let summary: PiggySummary | null = null;
  if (row.summary && typeof row.summary === 'object') {
    const s = row.summary as Partial<PiggySummary>;
    if (typeof s.name === 'string' && typeof s.walletBalance === 'number' && typeof s.bankBalance === 'number') {
      summary = {
        name: s.name,
        walletBalance: s.walletBalance,
        bankBalance: s.bankBalance,
        currency: typeof s.currency === 'string' ? s.currency : undefined,
        ownerNickname: typeof s.ownerNickname === 'string' || s.ownerNickname === null ? s.ownerNickname : null,
      };
    }
  }
  const memberPiggies = Array.isArray(row.memberPiggies)
    ? row.memberPiggies.map(sanitizePiggyMember).filter((m): m is PiggyMemberOrAccount => m !== null)
    : null;
  const pendingAccountRequests = Array.isArray(row.pendingAccountRequests)
    ? row.pendingAccountRequests.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const req = item as Partial<AccountRequest>;
        if (typeof req.id !== 'string' || typeof req.user_id !== 'string') return [];
        return [{
          id: req.id,
          user_id: req.user_id,
          nickname: typeof req.nickname === 'string' || req.nickname === null ? req.nickname : null,
        }];
      })
    : [];
  return {
    summary,
    memberPiggies: Array.isArray(row.memberPiggies) ? memberPiggies : null,
    pendingAccountRequests,
  };
}

function emptyVisitSnapshot(): DashboardContentSnapshot {
  return { todos: [], events: [], album: [], messages: [], piggy: null };
}

export function readDashboardContentSnapshot(
  userId: string,
  groupId: string,
  key: string,
): DashboardContentSnapshot | null {
  if (!userId || !groupId || !key || typeof window === 'undefined') return null;
  const id = storageKey(userId, groupId);
  const remembered = memory.get(id);
  if (remembered) return remembered;
  try {
    const raw = localStorage.getItem(id);
    if (!raw) return null;
    const parsed = CryptoService.decrypt(raw, key) as Partial<DashboardContentSnapshot> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    const snapshot: DashboardContentSnapshot = {
      todos: sanitizeTasks(parsed.todos),
      events: sanitizeEvents(parsed.events),
      album: [],
      messages: [],
      piggy: null,
    };
    memory.set(id, snapshot);
    return snapshot;
  } catch {
    return null;
  }
}

/** 일정 또는 할 일만 갱신해도 다른 쪽 마지막 값을 유지한다. */
export function writeDashboardContentSnapshot(
  userId: string,
  groupId: string,
  key: string,
  patch: Partial<DashboardContentSnapshot>,
): void {
  if (!userId || !groupId || !key || typeof window === 'undefined') return;
  const id = storageKey(userId, groupId);
  const prev = memory.get(id) ?? readDashboardContentSnapshot(userId, groupId, key) ?? emptyVisitSnapshot();
  const next: DashboardContentSnapshot = {
    todos: patch.todos ?? prev.todos,
    events: patch.events ?? prev.events,
    album: patch.album ? sanitizeAlbum(patch.album) : (prev.album ?? []),
    messages: patch.messages ? sanitizeMessages(patch.messages) : (prev.messages ?? []),
    piggy: 'piggy' in patch ? sanitizePiggy(patch.piggy) : (prev.piggy ?? null),
  };
  memory.set(id, next);
  try {
    localStorage.setItem(id, CryptoService.encrypt({ todos: next.todos, events: next.events }, key));
  } catch {
    // quota / private mode — 메모리 스냅샷은 유지
  }
}
