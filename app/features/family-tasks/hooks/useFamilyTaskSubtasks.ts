/**
 * 가족 임무 서브태스크 — 목록 조회·체크 토글·진행률, Realtime.
 * 항목 추가/수정/삭제는 임무 추가 시 초안·템플릿으로만 생성 (보기 창은 체크 전용).
 * 대시보드 page state에 올리지 않고 FamilyTasksSection 안에서만 사용.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import { acquireRealtimeChannel } from '@/lib/realtime-channel-lease';
import type { FamilyTaskSubtask, FamilyTaskSubtaskProgress } from '../types';

type CryptoService = {
  encrypt: (data: any, key: string) => string;
  decrypt: (cipher: string, key: string) => any;
};

function decryptTitle(raw: string, key: string, crypto: CryptoService): string {
  if (!raw || !key) return raw;
  if (!raw.startsWith('U2FsdGVkX1')) return raw;
  try {
    const decrypted = crypto.decrypt(raw, key);
    return typeof decrypted === 'string' && decrypted.length > 0 ? decrypted : raw;
  } catch {
    return raw;
  }
}

/** 미완료 위, 완료 아래. 각 묶음 안에서는 sort_order */
export function sortSubtasksForDisplay(items: FamilyTaskSubtask[]): FamilyTaskSubtask[] {
  const open = items
    .filter((s) => !s.done)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  const done = items
    .filter((s) => s.done)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  return [...open, ...done];
}

function progressFromRows(rows: Array<{ task_id: string; is_done: boolean }>): Record<string, FamilyTaskSubtaskProgress> {
  const next: Record<string, FamilyTaskSubtaskProgress> = {};
  for (const row of rows) {
    const id = String(row.task_id);
    const cur = next[id] ?? { done: 0, total: 0 };
    cur.total += 1;
    if (row.is_done) cur.done += 1;
    next[id] = cur;
  }
  return next;
}

function sameProgress(
  a: Record<string, FamilyTaskSubtaskProgress>,
  b: Record<string, FamilyTaskSubtaskProgress>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!b[key] || a[key].done !== b[key].done || a[key].total !== b[key].total) return false;
  }
  return true;
}

export function useFamilyTaskSubtaskProgress(currentGroupId: string | null) {
  const [progressByTaskId, setProgressByTaskId] = useState<Record<string, FamilyTaskSubtaskProgress>>({});

  const reload = useCallback(async () => {
    if (!currentGroupId) {
      setProgressByTaskId((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    const session = await waitForSupabaseSession(supabase);
    if (!session?.access_token) return;

    const { data, error } = await supabase
      .from('family_task_subtasks')
      .select('task_id, is_done')
      .eq('group_id', currentGroupId);

    if (error || !data) return;
    const next = progressFromRows(data);
    setProgressByTaskId((prev) => (sameProgress(prev, next) ? prev : next));
  }, [currentGroupId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await reload();
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    if (!currentGroupId) return;
    const gid = currentGroupId;
    const release = acquireRealtimeChannel(`family_task_subtasks_progress:${gid}`, (channel) =>
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_task_subtasks', filter: `group_id=eq.${gid}` },
        () => {
          void reload();
        },
      ),
    );
    return release;
  }, [currentGroupId, reload]);

  return { progressByTaskId, reloadProgress: reload };
}

export function useFamilyTaskSubtasks(input: {
  taskId: string | null;
  currentGroupId: string | null;
  getCurrentKey: () => string;
  CryptoService: CryptoService;
}) {
  const { taskId, currentGroupId, getCurrentKey, CryptoService } = input;
  const [items, setItems] = useState<FamilyTaskSubtask[]>([]);
  const [loading, setLoading] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const mapRow = useCallback(
    (row: {
      id: string;
      task_id: string;
      title: string;
      is_done: boolean;
      sort_order: number;
    }): FamilyTaskSubtask => ({
      id: String(row.id),
      task_id: String(row.task_id),
      text: decryptTitle(row.title || '', getCurrentKey(), CryptoService),
      done: !!row.is_done,
      sort_order: typeof row.sort_order === 'number' ? row.sort_order : 0,
    }),
    [CryptoService, getCurrentKey],
  );

  const load = useCallback(async () => {
    if (!taskId || !currentGroupId || /^\d+$/.test(taskId)) {
      setItems((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    setLoading(true);
    try {
      const session = await waitForSupabaseSession(supabase);
      if (!session?.access_token) return;

      const { data, error } = await supabase
        .from('family_task_subtasks')
        .select('id, task_id, title, is_done, sort_order')
        .eq('group_id', currentGroupId)
        .eq('task_id', taskId)
        .order('sort_order', { ascending: true });

      if (error || !data) return;
      setItems(sortSubtasksForDisplay(data.map(mapRow)));
    } finally {
      setLoading(false);
    }
  }, [taskId, currentGroupId, mapRow]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!taskId || !currentGroupId || /^\d+$/.test(taskId)) return;
    const tid = taskId;
    const gid = currentGroupId;
    const release = acquireRealtimeChannel(`family_task_subtasks_desk:${gid}:${tid}`, (channel) =>
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_task_subtasks',
          filter: `task_id=eq.${tid}`,
        },
        () => {
          void load();
        },
      ),
    );
    return release;
  }, [taskId, currentGroupId, load]);

  const toggleSubtask = useCallback(
    async (subtaskId: string, done: boolean) => {
      if (!currentGroupId) return;
      const prev = itemsRef.current;
      const optimistic = sortSubtasksForDisplay(
        prev.map((s) => (s.id === subtaskId ? { ...s, done } : s)),
      );
      setItems(optimistic);

      const { error } = await supabase
        .from('family_task_subtasks')
        .update({ is_done: done })
        .eq('id', subtaskId)
        .eq('group_id', currentGroupId);

      if (error) {
        setItems(prev);
        throw error;
      }
    },
    [currentGroupId],
  );

  return {
    items,
    loading,
    toggleSubtask,
    reload: load,
  };
}
