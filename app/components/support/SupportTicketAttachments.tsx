'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteAttachment,
  listAttachments,
  uploadFeatureAttachments,
  validateAttachmentFile,
  type FeatureEntityType,
  type UploadedAttachment,
} from '@/lib/feature-attachments-client';

export type SupportEntityType = Extract<
  FeatureEntityType,
  'member_support_ticket' | 'support_ticket'
>;

type Labels = {
  attach: string;
  uploading?: string;
  delete?: string;
  emptyHint?: string;
};

export function collectSupportAttachmentEntityIds(ticket: {
  id: string;
  answer_message_id?: string | null;
  message_thread?: unknown;
}): string[] {
  const ids = new Set<string>();
  ids.add(ticket.id);
  if (ticket.answer_message_id) ids.add(String(ticket.answer_message_id));
  const thread = Array.isArray(ticket.message_thread) ? ticket.message_thread : [];
  for (const entry of thread) {
    if (entry && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string') {
      ids.add(String((entry as { id: string }).id));
    }
  }
  return Array.from(ids);
}

export async function uploadSupportTicketFiles(params: {
  groupId: string;
  entityType: SupportEntityType;
  entityId: string;
  files: File[];
}): Promise<UploadedAttachment[]> {
  if (params.files.length === 0) return [];
  for (const file of params.files) {
    const err = validateAttachmentFile(file);
    if (err) throw new Error(err);
  }
  const jobs = await uploadFeatureAttachments({
    groupId: params.groupId,
    featureType: 'support',
    entityType: params.entityType,
    entityId: params.entityId,
    files: params.files,
    maxConcurrent: 3,
    retryCount: 1,
  });
  const failed = jobs.filter((j) => j.status === 'failed');
  if (failed.length > 0) {
    throw new Error(failed[0]?.error || `사진 ${failed.length}장 업로드에 실패했습니다.`);
  }
  return jobs
    .map((j) => j.attachment)
    .filter((a): a is UploadedAttachment => !!a);
}

/** 작성/추가 문의용: 로컬 선택 + 삭제 (업로드 전) */
export function SupportPendingAttachmentPicker({
  files,
  onChange,
  disabled,
  labels,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  labels: Labels;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrls = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files]
  );

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const handlePick = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      const err = validateAttachmentFile(file);
      if (err) {
        alert(err);
        continue;
      }
      next.push(file);
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeAt = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => handlePick(e.target.files)}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {labels.attach}
      </button>
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrls[index]} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                disabled={disabled}
                aria-label={labels.delete || '삭제'}
                onClick={() => removeAt(index)}
                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-[11px] font-bold text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 저장된 첨부 갤러리 (조회 + 업로더/관리자 삭제) */
export function SupportSavedAttachmentGallery({
  groupId,
  entityType,
  entityId,
  attachments: controlled,
  canDelete,
  onChanged,
  labels,
}: {
  groupId: string;
  entityType: SupportEntityType;
  entityId: string | null | undefined;
  attachments?: UploadedAttachment[];
  canDelete?: boolean;
  onChanged?: () => void;
  labels?: Pick<Labels, 'delete'>;
}) {
  const [rows, setRows] = useState<UploadedAttachment[]>(controlled ?? []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (controlled) {
      setRows(controlled);
      return;
    }
    if (!groupId || !entityId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    void listAttachments({ groupId, entityType, entityIds: [entityId] })
      .then((data) => {
        if (!cancelled) setRows(data.filter((a) => a.entity_id === entityId));
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [controlled, groupId, entityType, entityId]);

  const handleDelete = async (id: string) => {
    if (!canDelete || !groupId) return;
    setBusyId(id);
    try {
      await deleteAttachment(groupId, id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      onChanged?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : '첨부 삭제에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  if (!entityId || rows.length === 0) return null;

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {rows.map((row) => {
          const src = row.thumbnail_url || row.image_url;
          return (
            <div
              key={row.id}
              className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
            >
              <button
                type="button"
                className="h-full w-full cursor-zoom-in border-0 bg-transparent p-0"
                onClick={() => setLightbox(row.image_url)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
              {canDelete && (
                <button
                  type="button"
                  disabled={busyId === row.id}
                  aria-label={labels?.delete || '삭제'}
                  onClick={() => void handleDelete(row.id)}
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-[11px] font-bold text-white disabled:opacity-50"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
      {lightbox && (
        <div
          className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/75 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

/** 티켓 목록용: entityId → attachments 맵 로드 */
export function useSupportAttachmentsMap(
  groupId: string | null | undefined,
  entityType: SupportEntityType,
  entityIds: string[]
) {
  const [map, setMap] = useState<Record<string, UploadedAttachment[]>>({});
  const signature = useMemo(() => [...entityIds].sort().join(','), [entityIds]);

  const reload = useCallback(async () => {
    if (!groupId || entityIds.length === 0) {
      setMap({});
      return;
    }
    try {
      const rows = await listAttachments({ groupId, entityType, entityIds });
      const next: Record<string, UploadedAttachment[]> = {};
      for (const row of rows) {
        const key = row.entity_id;
        if (!next[key]) next[key] = [];
        next[key].push(row);
      }
      setMap(next);
    } catch {
      setMap({});
    }
  }, [groupId, entityType, entityIds]);

  useEffect(() => {
    void reload();
    // signature drives reload when id set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, entityType, signature]);

  return { map, reload };
}
