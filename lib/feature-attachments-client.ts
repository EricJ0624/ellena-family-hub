import { supabase } from '@/lib/supabase';

export type FeatureEntityType =
  | 'chat_message'
  | 'piggy_wallet_tx'
  | 'piggy_bank_tx'
  | 'travel_trip'
  | 'travel_expense';

export type UploadedAttachment = {
  id: string;
  group_id: string;
  uploader_id: string;
  feature_type: 'chat' | 'piggy' | 'travel';
  entity_type: FeatureEntityType;
  entity_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  image_url: string;
  thumbnail_url: string | null;
  created_at: string;
};

export type UploadJobStatus = 'queued' | 'uploading' | 'success' | 'failed' | 'cancelled';
export type UploadJob = {
  id: string;
  fileName: string;
  status: UploadJobStatus;
  progress: number;
  error?: string;
  attachment?: UploadedAttachment;
};

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const MAX_SIZE = 20 * 1024 * 1024;

export function validateAttachmentFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) return '지원하지 않는 파일 형식입니다.';
  if (file.size <= 0 || file.size > MAX_SIZE) return '파일 크기는 1B~20MB여야 합니다.';
  return null;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('인증 세션이 필요합니다.');
  return { Authorization: `Bearer ${token}` };
}

function fileToImageBitmap(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

async function compressImageAuto(file: File): Promise<File> {
  const bitmap = await fileToImageBitmap(file);
  const maxEdge = 1920;
  const quality = 0.82;
  const ratio = Math.min(maxEdge / bitmap.width, maxEdge / bitmap.height, 1);
  const w = Math.max(1, Math.round(bitmap.width * ratio));
  const h = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality);
  });
  if (!blob) return file;
  const outType = blob.type || file.type || 'image/jpeg';
  const ext = outType === 'image/png' ? 'png' : outType === 'image/webp' ? 'webp' : 'jpg';
  const name = file.name.replace(/\.[^.]+$/, '') + `.${ext}`;
  return new File([blob], name, { type: outType, lastModified: Date.now() });
}

async function makeThumbnail(file: File): Promise<Blob> {
  const bitmap = await fileToImageBitmap(file);
  const maxEdge = 512;
  const ratio = Math.min(maxEdge / bitmap.width, maxEdge / bitmap.height, 1);
  const w = Math.max(1, Math.round(bitmap.width * ratio));
  const h = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('썸네일 생성에 실패했습니다.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('썸네일 생성 실패'));
      resolve(blob);
    }, 'image/webp', 0.82);
  });
}

async function getUploadUrl(groupId: string, fileName: string, mimeType: string, fileSize: number, isThumbnail: boolean) {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/attachments/get-upload-url', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, fileName, mimeType, fileSize, isThumbnail }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || '업로드 URL 생성 실패');
  return json as { presignedUrl: string; s3Key: string; s3Url: string };
}

export async function uploadFeatureAttachment(params: {
  groupId: string;
  featureType: 'chat' | 'piggy' | 'travel';
  entityType: FeatureEntityType;
  entityId: string;
  file: File;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}) {
  const { groupId, featureType, entityType, entityId, signal, onProgress } = params;
  const file = await compressImageAuto(params.file);
  const validationError = validateAttachmentFile(file);
  if (validationError) throw new Error(validationError);
  onProgress?.(10);
  if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');

  const originalMeta = await getUploadUrl(groupId, file.name, file.type, file.size, false);
  const putOriginal = await fetch(originalMeta.presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
    signal,
  });
  if (!putOriginal.ok) throw new Error('원본 업로드 실패');
  onProgress?.(55);
  if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');

  const thumbnailBlob = await makeThumbnail(file);
  const thumbnailMeta = await getUploadUrl(groupId, `${file.name}.thumb.webp`, 'image/webp', thumbnailBlob.size, true);
  const putThumb = await fetch(thumbnailMeta.presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/webp' },
    body: thumbnailBlob,
    signal,
  });
  if (!putThumb.ok) throw new Error('썸네일 업로드 실패');
  onProgress?.(85);
  if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');

  const headers = await getAuthHeaders();
  const completeRes = await fetch('/api/attachments/complete', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      groupId,
      featureType,
      entityType,
      entityId,
      originalFilename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      s3Key: originalMeta.s3Key,
      imageUrl: originalMeta.s3Url,
      thumbnailS3Key: thumbnailMeta.s3Key,
      thumbnailUrl: thumbnailMeta.s3Url,
    }),
  });
  const completeJson = await completeRes.json().catch(() => ({}));
  if (!completeRes.ok) throw new Error(completeJson.error || '첨부 저장 실패');
  onProgress?.(100);
  return completeJson.data as UploadedAttachment;
}

export async function uploadFeatureAttachments(params: {
  groupId: string;
  featureType: 'chat' | 'piggy' | 'travel';
  entityType: FeatureEntityType;
  entityId: string;
  files: File[];
  maxConcurrent?: number;
  retryCount?: number;
  onJobsChange?: (jobs: UploadJob[]) => void;
  signal?: AbortSignal;
}) {
  const {
    groupId,
    featureType,
    entityType,
    entityId,
    files,
    signal,
  } = params;
  const maxConcurrent = Math.max(1, params.maxConcurrent ?? 3);
  const retryCount = Math.max(0, params.retryCount ?? 1);

  const jobs: UploadJob[] = files.map((f) => ({
    id: uid(),
    fileName: f.name,
    status: 'queued',
    progress: 0,
  }));
  const emit = () => params.onJobsChange?.([...jobs]);
  emit();

  let cursor = 0;
  const worker = async () => {
    while (cursor < files.length) {
      const index = cursor++;
      const file = files[index]!;
      const job = jobs[index]!;
      if (signal?.aborted) {
        job.status = 'cancelled';
        job.progress = 0;
        emit();
        continue;
      }
      let attempt = 0;
      while (attempt <= retryCount) {
        try {
          job.status = 'uploading';
          emit();
          const attachment = await uploadFeatureAttachment({
            groupId,
            featureType,
            entityType,
            entityId,
            file,
            signal,
            onProgress: (p) => {
              job.progress = p;
              emit();
            },
          });
          job.status = 'success';
          job.attachment = attachment;
          emit();
          break;
        } catch (e) {
          attempt += 1;
          if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
            job.status = 'cancelled';
            job.error = '사용자 취소';
            emit();
            break;
          }
          if (attempt > retryCount) {
            job.status = 'failed';
            job.error = e instanceof Error ? e.message : '업로드 실패';
            emit();
            break;
          }
        }
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(maxConcurrent, files.length) }).map(() => worker()));
  return jobs;
}

export async function listAttachments(params: { groupId: string; entityType: FeatureEntityType; entityIds: string[] }) {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/attachments', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || '첨부 조회 실패');
  return (json.data ?? []) as UploadedAttachment[];
}

export async function getAttachmentsForEntity(params: { groupId: string; entityType: FeatureEntityType; entityId: string }) {
  const headers = await getAuthHeaders();
  const url = new URL('/api/attachments', window.location.origin);
  url.searchParams.set('groupId', params.groupId);
  url.searchParams.set('entityType', params.entityType);
  url.searchParams.set('entityId', params.entityId);
  
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || '첨부 조회 실패');
  return (json.data ?? []) as UploadedAttachment[];
}

export async function deleteAttachment(groupId: string, attachmentId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/attachments', {
    method: 'DELETE',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, attachmentId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || '첨부 삭제 실패');
}
