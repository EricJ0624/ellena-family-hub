'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGroup } from '@/app/contexts/GroupContext';
import { useAlbum } from '@/app/contexts/AlbumContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getDashboardTranslation, type DashboardTranslations } from '@/lib/translations/dashboard';
import { getCommonTranslation, type CommonTranslations } from '@/lib/translations/common';
import {
  getDisplayImageData,
  getMimeTypeFromExtension,
  isRawFileExtension,
} from '@/lib/photo-upload-utils';
import { supabase } from '@/lib/supabase';

const PRESIGNED_URL_THRESHOLD = 3 * 1024 * 1024; // 3MB (대시보드와 동일)
const MAX_SAFE_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export default function MemoriesPage() {
  const { currentGroupId } = useGroup();
  const { album, addPhoto, deletePhoto, updatePhotoDescription, updatePhotoId } = useAlbum();
  const { lang } = useLanguage();
  const dt = (key: keyof DashboardTranslations) => getDashboardTranslation(lang, key);
  const ct = (key: keyof CommonTranslations) => getCommonTranslation(lang, key);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gridColumns, setGridColumns] = useState(3);

  // 사진 장수 우선: 1~5장→1열, 6~15장→3열, 16장+→5열. 화면이 좁으면 그에 맞춰 열 수만 줄임.
  useEffect(() => {
    let rafId: number | undefined;
    const updateColumns = () => {
      rafId = requestAnimationFrame(() => {
        rafId = undefined;
        const n = album.length;
        const photoBasedCols = n <= 5 ? 1 : n <= 15 ? 3 : 5;
        const w =
          typeof window !== 'undefined' && window.visualViewport
            ? window.visualViewport.width
            : typeof window !== 'undefined'
              ? window.innerWidth
              : 900;
        const viewportCols = w < 320 ? 1 : w < 520 ? 3 : 5;
        const cols = Math.min(photoBasedCols, viewportCols);
        setGridColumns(cols);
      });
    };
    updateColumns();
    window.addEventListener('resize', updateColumns);
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (vv) {
      vv.addEventListener('resize', updateColumns);
    }
    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateColumns);
      if (vv) {
        vv.removeEventListener('resize', updateColumns);
      }
    };
  }, [album.length]);

  const handleBack = () => { window.location.href = '/dashboard'; };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!currentGroupId) {
      alert(dt('group_info_missing'));
      e.target.value = '';
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const mimeType = file.type || getMimeTypeFromExtension(ext) || 'image/jpeg';
    const ALLOWED_TYPES = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
      'image/x-canon-cr2', 'image/x-nikon-nef', 'image/x-sony-arw', 'image/x-adobe-dng', 'image/x-raw',
    ];
    const allowedExtensions = [
      'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif',
      'raw', 'cr2', 'nef', 'arw', 'orf', 'rw2', 'dng', 'raf', 'srw', 'tif', 'tiff',
    ];
    const isValidType = ALLOWED_TYPES.includes(mimeType) || (file.type === '' && allowedExtensions.includes(ext));
    if (!isValidType) {
      alert(dt('unsupported_file_format'));
      e.target.value = '';
      return;
    }
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      alert(dt('invalid_filename'));
      e.target.value = '';
      return;
    }
    if (file.size > MAX_SAFE_FILE_SIZE) {
      const msg = `파일이 매우 큽니다 (${Math.round(file.size / 1024 / 1024)}MB).\n\n업로드에 시간이 오래 걸릴 수 있습니다. 계속하시겠습니까?`;
      if (!confirm(msg)) {
        e.target.value = '';
        return;
      }
    }
    const isRawFile = isRawFileExtension(ext);
    let imageData: string;
    let originalData: string;
    try {
      originalData = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      imageData = await getDisplayImageData(file);
    } catch (err) {
      alert(dt('image_processing_error') + (err instanceof Error ? err.message : ct('error_unknown')));
      e.target.value = '';
      return;
    }
    const uploadFileName = file.name;
    const uploadMimeType = mimeType;
    const uploadFileSize = file.size;
    const photoId = Date.now();
    addPhoto({
      id: photoId,
      data: imageData,
      originalSize: file.size,
      originalFilename: file.name,
      mimeType: uploadMimeType,
      isUploading: true,
    });
    let uploadCompleted = false;
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError?.message?.includes('Refresh Token')) {
        deletePhoto(photoId);
        e.target.value = '';
        return;
      }
      if (!session) {
        deletePhoto(photoId);
        e.target.value = '';
        return;
      }
      const usePresignedUrl = isRawFile || uploadFileSize >= PRESIGNED_URL_THRESHOLD;
      const authHeader = () => ({ Authorization: `Bearer ${session.access_token}` });

      if (usePresignedUrl) {
        try {
          const urlController = new AbortController();
          const urlTimeout = setTimeout(() => urlController.abort(), 10000);
          const urlRes = await fetch('/api/get-upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({
              fileName: uploadFileName,
              mimeType: uploadMimeType,
              fileSize: uploadFileSize,
              groupId: currentGroupId,
            }),
            signal: urlController.signal,
          });
          clearTimeout(urlTimeout);
          if (!urlRes.ok) {
            const errBody = await urlRes.json().catch(() => ({}));
            throw new Error(errBody.error || errBody.details || 'Presigned URL 요청 실패');
          }
          const { presignedUrl, s3Key, s3Url } = await urlRes.json();
          const putRes = await fetch(presignedUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': uploadMimeType },
          });
          if (!putRes.ok) throw new Error('S3 직접 업로드 실패');
          const completeController = new AbortController();
          const completeTimeout = setTimeout(() => completeController.abort(), 180000);
          const completeRes = await fetch('/api/complete-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({
              s3Key,
              s3Url,
              fileName: uploadFileName,
              mimeType: uploadMimeType,
              originalSize: uploadFileSize,
              resizedData: imageData !== originalData ? imageData : null,
              groupId: currentGroupId,
              forceCloudinary: isRawFile,
            }),
            signal: completeController.signal,
          });
          clearTimeout(completeTimeout);
          const completeResult = await completeRes.json();
          if (completeRes.ok && completeResult.id && (completeResult.cloudinaryUrl ?? completeResult.s3Url)) {
            updatePhotoId({
              oldId: photoId,
              newId: completeResult.id,
              cloudinaryUrl: completeResult.cloudinaryUrl ?? null,
              s3Url: completeResult.s3Url ?? null,
            });
            uploadCompleted = true;
          } else if (completeRes.ok) {
            updatePhotoId({
              oldId: photoId,
              newId: photoId,
              cloudinaryUrl: null,
              s3Url: s3Url,
            });
            uploadCompleted = true;
          } else {
            updatePhotoId({ oldId: photoId, newId: photoId, cloudinaryUrl: null, s3Url: s3Url });
            uploadCompleted = true;
          }
        } catch (presignedErr: unknown) {
          const errMsg = presignedErr instanceof Error ? presignedErr.message : '';
          const isCors = errMsg.includes('CORS') || errMsg.includes('Failed to fetch');
          if (isCors || errMsg.includes('S3') || errMsg.includes('Presigned')) {
            try {
              const fallbackRes = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeader() },
                body: JSON.stringify({
                  originalData,
                  resizedData: imageData !== originalData ? imageData : null,
                  fileName: uploadFileName,
                  mimeType: uploadMimeType,
                  originalSize: uploadFileSize,
                  groupId: currentGroupId,
                  forceCloudinary: isRawFile,
                }),
              });
              const fallbackResult = await fallbackRes.json();
              if (fallbackRes.ok && fallbackResult.id && (fallbackResult.cloudinaryUrl || fallbackResult.s3Url)) {
                updatePhotoId({
                  oldId: photoId,
                  newId: fallbackResult.id,
                  cloudinaryUrl: fallbackResult.cloudinaryUrl,
                  s3Url: fallbackResult.s3Url,
                });
                uploadCompleted = true;
                if (isCors) alert('업로드 완료: CORS 오류로 인해 서버 경유 방식으로 업로드되었습니다.');
              } else {
                throw presignedErr;
              }
            } catch {
              throw presignedErr;
            }
          } else {
            throw presignedErr;
          }
        }
      } else {
        const uploadController = new AbortController();
        const uploadTimeout = setTimeout(() => uploadController.abort(), 60000);
        try {
          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({
              originalData,
              resizedData: imageData !== originalData ? imageData : null,
              fileName: uploadFileName,
              mimeType: uploadMimeType,
              originalSize: uploadFileSize,
              groupId: currentGroupId,
            }),
            signal: uploadController.signal,
          });
          clearTimeout(uploadTimeout);
          const result = await uploadRes.json();
          if (uploadRes.ok && result.id && (result.cloudinaryUrl || result.s3Url)) {
            updatePhotoId({
              oldId: photoId,
              newId: result.id,
              cloudinaryUrl: result.cloudinaryUrl,
              s3Url: result.s3Url,
            });
            uploadCompleted = true;
          } else {
            deletePhoto(photoId);
            uploadCompleted = true;
            const fileSizeDisplay = uploadFileSize >= 1024 * 1024
              ? `${(uploadFileSize / 1024 / 1024).toFixed(2)}MB`
              : `${(uploadFileSize / 1024).toFixed(2)}KB`;
            const fileInfo = `파일: ${uploadFileName}\n크기: ${fileSizeDisplay}\n형식: ${uploadMimeType}`;
            const failureReason = result.error || result.details || '업로드 실패';
            alert(`사진 업로드 실패\n\n${fileInfo}\n\n실패 이유:\n${failureReason}`);
          }
        } catch (fetchErr: unknown) {
          clearTimeout(uploadTimeout);
          deletePhoto(photoId);
          uploadCompleted = true;
          const fileSizeDisplay = uploadFileSize >= 1024 * 1024
            ? `${(uploadFileSize / 1024 / 1024).toFixed(2)}MB`
            : `${(uploadFileSize / 1024).toFixed(2)}KB`;
          const fileInfo = `파일: ${uploadFileName}\n크기: ${fileSizeDisplay}\n형식: ${uploadMimeType}`;
          let failureReason: string;
          if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
            failureReason = '업로드 타임아웃 (60초 초과)';
          } else if (fetchErr instanceof Error && (fetchErr.message?.includes('Failed to fetch') || fetchErr.message?.includes('NetworkError'))) {
            failureReason = `네트워크 오류: ${fetchErr.message || '서버에 연결할 수 없습니다.'}`;
          } else {
            throw fetchErr;
          }
          alert(`사진 업로드 실패\n\n${fileInfo}\n\n실패 이유:\n${failureReason}`);
        }
      }
    } catch (uploadErr: unknown) {
      const errorMessage = uploadErr instanceof Error ? uploadErr.message : '업로드 중 오류가 발생했습니다.';
      console.error('사진 업로드 실패:', uploadErr);
      deletePhoto(photoId);
      uploadCompleted = true;
      const fileSizeDisplay = uploadFileSize >= 1024 * 1024
        ? `${(uploadFileSize / 1024 / 1024).toFixed(2)}MB`
        : `${(uploadFileSize / 1024).toFixed(2)}KB`;
      const fileInfo = `파일: ${uploadFileName}\n크기: ${fileSizeDisplay}\n형식: ${uploadMimeType}`;
      let failureReason: string;
      if (errorMessage.includes('Cloudinary 환경 변수') || errorMessage.includes('CLOUDINARY')) {
        failureReason = 'Cloudinary 환경 변수가 설정되지 않았습니다.\n\n필요한 환경 변수:\n- CLOUDINARY_CLOUD_NAME\n- CLOUDINARY_API_KEY\n- CLOUDINARY_API_SECRET\n\n.env.local 파일과 Vercel 환경 변수에 설정해주세요.';
      } else if (errorMessage.includes('AWS_S3_BUCKET_NAME') || errorMessage.includes('S3 환경 변수')) {
        failureReason = 'S3 환경 변수가 설정되지 않았습니다.\n\n필요한 환경 변수:\n- AWS_S3_BUCKET_NAME\n- AWS_ACCESS_KEY_ID\n- AWS_SECRET_ACCESS_KEY\n- AWS_REGION\n\n.env.local 파일과 Vercel 환경 변수에 설정해주세요.';
      } else if (errorMessage.includes('Cloudinary와 S3 업로드가 모두 실패')) {
        failureReason = 'Cloudinary와 S3 업로드가 모두 실패했습니다.\n\n환경 변수를 확인해주세요:\n- Cloudinary: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET\n- S3: AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION';
      } else if (errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch')) {
        failureReason = 'S3 버킷 CORS 설정이 필요합니다.\n\nS3 버킷의 CORS 설정을 확인하거나 관리자에게 문의하세요.';
      } else if (errorMessage.includes('타임아웃') || errorMessage.toLowerCase().includes('timeout')) {
        failureReason = '파일이 너무 크거나 네트워크 연결이 불안정합니다.';
      } else {
        failureReason = errorMessage;
      }
      const userMessage = `사진 업로드 실패\n\n${fileInfo}\n\n실패 이유:\n${failureReason}`;
      alert(userMessage);
    } finally {
      if (!uploadCompleted) {
        deletePhoto(photoId);
      }
      e.target.value = '';
    }
  };

  const openLightbox = (index: number) => setSelectedIndex(index);
  const closeLightbox = () => setSelectedIndex(null);

  return (
    <div className="memories-page" style={{ minHeight: '100vh', background: 'var(--bg-dashboard, #f8fafc)', paddingBottom: 80 }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          aria-label={ct('back') || '뒤로'}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: 8,
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#fff',
          }}
        >
          <ChevronLeft size={24} />
        </button>
        <h1 style={{ flex: 1, margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
          {dt('section_title_memories')}
        </h1>
        <label
          htmlFor="memories-file-input"
          style={{
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.25)',
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          {dt('photo_upload_btn')}
        </label>
        <input
          id="memories-file-input"
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif,.raw,.cr2,.nef,.arw,.orf,.rw2,.dng,.raf,.srw"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </header>

      <main style={{ padding: 16, maxWidth: 1200, margin: '0 auto', overflowX: 'hidden' }}>
        {album.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #cbd5e1',
              borderRadius: 12,
              padding: 48,
              textAlign: 'center',
              color: '#94a3b8',
              cursor: 'pointer',
              background: '#f8fafc',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
            <div>{dt('photo_upload_prompt')}</div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
              gap: 12,
            }}
          >
            {album.map((p, index) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="memory-card"
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openLightbox(index)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(index); } }}
                  style={{ cursor: 'pointer', position: 'relative' }}
                >
                  <div style={{ aspectRatio: '4/3', background: '#f1f5f9', position: 'relative' }}>
                    <img
                      src={p.data}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                    {p.isUploading && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0,0,0,0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 600,
                        }}
                      >
                        업로드 중...
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ padding: 12 }}>
                  {editingId === p.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder={dt('photo_description_placeholder')}
                        style={{
                          width: '100%',
                          padding: 8,
                          border: '1px solid #6366f1',
                          borderRadius: 6,
                          fontSize: 14,
                        }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => {
                            updatePhotoDescription({ photoId: p.id, description: editDescription });
                            setEditingId(null);
                            setEditDescription('');
                          }}
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            background: '#6366f1',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {ct('save')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditDescription('');
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#e2e8f0',
                            color: '#64748b',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {ct('cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(dt('photo_delete_confirm'))) {
                              deletePhoto(p.id);
                              setEditingId(null);
                              setEditDescription('');
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {ct('delete')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setEditingId(p.id);
                        setEditDescription(p.description || '');
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setEditingId(p.id); setEditDescription(p.description || ''); } }}
                      style={{
                        fontSize: 14,
                        color: p.description ? '#1e293b' : '#94a3b8',
                        minHeight: 20,
                        cursor: 'pointer',
                      }}
                    >
                      {p.description || dt('photo_description_hint')}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <AnimatePresence>
        {selectedIndex !== null && album[selectedIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.95)',
              zIndex: 10000,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '56px 24px 24px',
              boxSizing: 'border-box',
            }}
            onClick={closeLightbox}
          >
            <button
              type="button"
              onClick={closeLightbox}
              aria-label={ct('close') || '닫기'}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '50%',
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#fff',
                zIndex: 1,
              }}
            >
              <X size={24} />
            </button>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={album[selectedIndex].data}
                alt=""
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: 8,
                }}
              />
            </div>
            <p
              style={{
                flexShrink: 0,
                marginTop: 12,
                color: 'rgba(255,255,255,0.9)',
                fontSize: 14,
                textAlign: 'center',
                maxWidth: 400,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {album[selectedIndex].description || dt('photo_description_hint')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
