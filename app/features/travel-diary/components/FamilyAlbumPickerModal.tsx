'use client';

import { useEffect, useState } from 'react';
import { GlassSafeModal } from '@/app/components/GlassSafeModal';
import { supabase } from '@/lib/supabase';
import { DB_TABLES } from '@/lib/db-table-names';

export type AlbumPickItem = {
  id: string;
  image_url: string;
};

export function FamilyAlbumPickerModal({
  open,
  onClose,
  groupId,
  attachedImageUrls,
  labels,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  attachedImageUrls: string[];
  labels: {
    title: string;
    close: string;
    empty: string;
    add: string;
  };
  onConfirm: (albumItemIds: string[]) => Promise<void>;
}) {
  const [items, setItems] = useState<AlbumPickItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data } = await supabase
        .from(DB_TABLES.FAMILY_ALBUM_ITEMS)
        .select('id, image_url, s3_key, file_type')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (cancelled) return;
      const rows = (data ?? [])
        .filter((row) => {
          const fileType = String((row as { file_type?: string | null }).file_type || 'photo');
          const s3Key = String((row as { s3_key?: string | null }).s3_key || '');
          const imageUrl = String((row as { image_url?: string }).image_url || '');
          return fileType !== 'video' && imageUrl && s3Key && !attachedImageUrls.includes(imageUrl);
        })
        .map((row) => ({
          id: String((row as { id: string }).id),
          image_url: String((row as { image_url: string }).image_url),
        }));
      setItems(rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, groupId, attachedImageUrls]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <GlassSafeModal open={open} onClose={onClose} maxWidthClass="max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800">{labels.title}</p>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-lg border-0 bg-transparent px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          {labels.close}
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">{labels.empty}</p>
      ) : (
        <div className="mt-4 grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto">
          {items.map((item) => {
            const on = selected.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className={[
                  'overflow-hidden rounded-lg border-2 p-0',
                  on ? 'border-violet-500 ring-2 ring-violet-300' : 'border-transparent',
                ].join(' ')}
              >
                <img src={item.image_url} alt="" className="aspect-square h-auto w-full object-cover" />
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={saving || selected.size === 0}
          onClick={() => {
            void (async () => {
              setSaving(true);
              try {
                await onConfirm([...selected]);
                onClose();
              } finally {
                setSaving(false);
              }
            })();
          }}
          className="cursor-pointer rounded-lg border-0 bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {labels.add}
        </button>
      </div>
    </GlassSafeModal>
  );
}
