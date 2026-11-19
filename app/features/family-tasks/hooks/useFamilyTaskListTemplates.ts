/**
 * 서브태스크 목록 템플릿 (장보기 등) — 그룹 공유 저장/불러오기/삭제
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import type { FamilyTaskListTemplate } from '../types';

type CryptoService = {
  encrypt: (data: any, key: string) => string;
  decrypt: (cipher: string, key: string) => any;
};

function decryptText(raw: string, key: string, crypto: CryptoService): string {
  if (!raw || !key) return raw;
  if (!raw.startsWith('U2FsdGVkX1')) return raw;
  try {
    const decrypted = crypto.decrypt(raw, key);
    return typeof decrypted === 'string' && decrypted.length > 0 ? decrypted : raw;
  } catch {
    return raw;
  }
}

export function useFamilyTaskListTemplates(input: {
  currentGroupId: string | null;
  userId: string;
  getCurrentKey: () => string;
  CryptoService: CryptoService;
}) {
  const { currentGroupId, userId, getCurrentKey, CryptoService } = input;
  const [templates, setTemplates] = useState<FamilyTaskListTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!currentGroupId) {
      setTemplates([]);
      return;
    }
    setLoading(true);
    try {
      const session = await waitForSupabaseSession(supabase);
      if (!session?.access_token) return;

      const { data: tplRows, error } = await supabase
        .from('family_task_list_templates')
        .select('id, name, created_at')
        .eq('group_id', currentGroupId)
        .order('created_at', { ascending: false });

      if (error || !tplRows) {
        setTemplates([]);
        return;
      }

      const ids = tplRows.map((r) => String(r.id));
      const countById = new Map<string, number>();
      if (ids.length > 0) {
        const { data: itemRows } = await supabase
          .from('family_task_list_template_items')
          .select('template_id')
          .eq('group_id', currentGroupId)
          .in('template_id', ids);
        for (const row of itemRows || []) {
          const id = String(row.template_id);
          countById.set(id, (countById.get(id) ?? 0) + 1);
        }
      }

      const key = getCurrentKey();
      setTemplates(
        tplRows.map((row) => ({
          id: String(row.id),
          name: decryptText(row.name || '', key, CryptoService),
          created_at: String(row.created_at || ''),
          item_count: countById.get(String(row.id)) ?? 0,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [currentGroupId, getCurrentKey, CryptoService]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const saveTemplate = useCallback(
    async (name: string, itemTexts: string[]) => {
      if (!currentGroupId || !name.trim()) throw new Error('이름을 입력해 주세요.');
      const titles = itemTexts.map((t) => t.trim()).filter(Boolean);
      if (titles.length === 0) throw new Error('저장할 항목이 없습니다.');

      const key = getCurrentKey();
      const { data: inserted, error } = await supabase
        .from('family_task_list_templates')
        .insert({
          group_id: currentGroupId,
          name: CryptoService.encrypt(name.trim(), key),
          created_by: userId,
        })
        .select('id')
        .single();

      if (error || !inserted?.id) throw error || new Error('템플릿 저장 실패');

      const rows = titles.map((text, index) => ({
        template_id: inserted.id,
        group_id: currentGroupId,
        title: CryptoService.encrypt(text, key),
        sort_order: index,
      }));

      const { error: itemsError } = await supabase.from('family_task_list_template_items').insert(rows);
      if (itemsError) {
        await supabase.from('family_task_list_templates').delete().eq('id', inserted.id);
        throw itemsError;
      }

      await loadTemplates();
      return String(inserted.id);
    },
    [currentGroupId, userId, getCurrentKey, CryptoService, loadTemplates],
  );

  const loadTemplateItemTexts = useCallback(
    async (templateId: string): Promise<string[]> => {
      if (!currentGroupId) return [];
      const { data, error } = await supabase
        .from('family_task_list_template_items')
        .select('title, sort_order')
        .eq('group_id', currentGroupId)
        .eq('template_id', templateId)
        .order('sort_order', { ascending: true });

      if (error || !data) throw error || new Error('목록을 불러오지 못했습니다.');
      const key = getCurrentKey();
      return data.map((row) => decryptText(row.title || '', key, CryptoService)).filter(Boolean);
    },
    [currentGroupId, getCurrentKey, CryptoService],
  );

  return {
    templates,
    loading,
    saveTemplate,
    loadTemplateItemTexts,
    reloadTemplates: loadTemplates,
  };
}
