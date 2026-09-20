import { supabase } from '@/lib/supabase';
import {
  ensureImageFileWithKnownMime,
  validateAttachmentFile,
} from '@/lib/feature-attachments-client';
import { mapPictureFindUploadError } from '@/lib/picture-find/upload-errors';
import type { PictureFindDiffMode, PictureFindScene } from '@/lib/picture-find/types';

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('인증 세션이 필요합니다.');
  return session.access_token;
}

/** HEIC 포함 → JPEG로 변환. 실패 시 MIME만 보정한 원본 반환 */
async function compressForPictureFind(file: File): Promise<File> {
  const prepared = ensureImageFileWithKnownMime(file);
  try {
    const bitmap = await createImageBitmap(prepared);
    const maxEdge = 1920;
    const ratio = Math.min(maxEdge / bitmap.width, maxEdge / bitmap.height, 1);
    const w = Math.max(1, Math.round(bitmap.width * ratio));
    const h = Math.max(1, Math.round(bitmap.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return prepared;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
    });
    if (!blob) return prepared;
    const name = prepared.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    // Safari 외에서 HEIC decode 실패 시 JPEG가 아니면 명확히 안내
    const mime = prepared.type.toLowerCase();
    if (mime === 'image/heic' || mime === 'image/heif' || /\.heic$/i.test(prepared.name)) {
      throw new Error('HEIC 변환에 실패했습니다. JPEG/PNG로 저장 후 올려 주세요.');
    }
    return prepared;
  }
}

/** 서버 업로드 (브라우저→S3 CORS / Load failed 회피) */
async function uploadImageViaServer(groupId: string, file: File, token: string) {
  const prepared = await compressForPictureFind(file);
  const validationError = validateAttachmentFile(prepared);
  if (validationError) throw new Error(validationError);

  const form = new FormData();
  form.append('groupId', groupId);
  form.append('file', prepared, prepared.name);

  const res = await fetch('/api/v1/picture-find/upload-image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || '이미지 업로드 실패');
  }
  return {
    s3Key: String(json.s3Key),
    imageUrl: String(json.imageUrl),
    sizeBytes: Number(json.sizeBytes) || prepared.size,
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

  try {
    const token = await getAccessToken();

    onProgress?.(10);
    const original = await uploadImageViaServer(groupId, originalFile, token);
    onProgress?.(diffMode === 'manual' ? 45 : 70);

    let variant: { s3Key: string; imageUrl: string; sizeBytes: number } | null = null;
    if (diffMode === 'manual') {
      if (!variantFile) throw new Error('비교 이미지를 선택해 주세요.');
      variant = await uploadImageViaServer(groupId, variantFile, token);
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
  } catch (e) {
    throw new Error(mapPictureFindUploadError(e, '장면 저장에 실패했습니다.'));
  }
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
