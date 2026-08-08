import { supabase } from '@/lib/supabase';
import {
  ensureImageFileWithKnownMime,
  validateAttachmentFile,
} from '@/lib/feature-attachments-client';
import type { PictureFindDiffMode, PictureFindScene } from '@/lib/picture-find/types';

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('인증 세션이 필요합니다.');
  return session.access_token;
}

async function compressForPictureFind(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 1920;
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
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
    });
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return ensureImageFileWithKnownMime(file);
  }
}

async function uploadImageToS3(groupId: string, file: File, token: string) {
  const prepared = await compressForPictureFind(ensureImageFileWithKnownMime(file));
  const validationError = validateAttachmentFile(prepared);
  if (validationError) throw new Error(validationError);

  const urlRes = await fetch('/api/attachments/get-upload-url', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      groupId,
      fileName: prepared.name,
      mimeType: prepared.type,
      fileSize: prepared.size,
      isThumbnail: false,
    }),
  });
  const urlJson = await urlRes.json().catch(() => ({}));
  if (!urlRes.ok) throw new Error(urlJson.error || '업로드 URL 생성 실패');

  const putRes = await fetch(urlJson.presignedUrl as string, {
    method: 'PUT',
    headers: { 'Content-Type': prepared.type },
    body: prepared,
  });
  if (!putRes.ok) throw new Error('이미지 업로드 실패');

  return {
    s3Key: String(urlJson.s3Key),
    imageUrl: String(urlJson.s3Url),
    sizeBytes: prepared.size,
  };
}

export async function createPictureFindSceneFromUpload(params: {
  groupId: string;
  title: string;
  diffMode: PictureFindDiffMode;
  originalFile: File;
  variantFile?: File | null;
  onProgress?: (progress: number) => void;
}): Promise<PictureFindScene> {
  const { groupId, title, diffMode, originalFile, variantFile, onProgress } = params;
  const token = await getAccessToken();

  onProgress?.(10);
  const original = await uploadImageToS3(groupId, originalFile, token);
  onProgress?.(diffMode === 'manual' ? 45 : 70);

  let variant: { s3Key: string; imageUrl: string; sizeBytes: number } | null = null;
  if (diffMode === 'manual') {
    if (!variantFile) throw new Error('비교 이미지를 선택해 주세요.');
    variant = await uploadImageToS3(groupId, variantFile, token);
    onProgress?.(75);
  }

  const createRes = await fetch('/api/v1/picture-find/scenes', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      groupId,
      title,
      imageUrl: original.imageUrl,
      imageS3Key: original.s3Key,
      imageSizeBytes: original.sizeBytes,
      diffMode,
      variantImageUrl: variant?.imageUrl ?? null,
      variantImageS3Key: variant?.s3Key ?? null,
      variantImageSizeBytes: variant?.sizeBytes ?? 0,
    }),
  });
  const createJson = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    throw new Error(createJson.error || createJson.details || '장면 저장 실패');
  }
  onProgress?.(100);
  return createJson.data as PictureFindScene;
}

export async function deletePictureFindScene(sceneId: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`/api/v1/picture-find/scenes/${encodeURIComponent(sceneId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || '장면 삭제 실패');
}
