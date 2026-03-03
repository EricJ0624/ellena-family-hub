'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ChevronLeft, X, Trash2 } from 'lucide-react';
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

/** 파일명에서 날짜 추출 (IMG_20240115_123456, 2024-01-15 등). ISO 문자열 또는 null */
function parseTakenAtFromFilename(filename: string): string | null {
  const base = filename.replace(/\.[a-zA-Z0-9]+$/, '');
  const match =
    base.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/) ||
    base.match(/(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = parseInt(y!, 10);
  const month = parseInt(m!, 10) - 1;
  const day = parseInt(d!, 10);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

export default function MemoriesPage() {
  const { currentGroupId } = useGroup();
  const { album, addPhoto, deletePhoto, updatePhotoDescription, updatePhotoId } = useAlbum();
  const { lang } = useLanguage();
  const dt = (key: keyof DashboardTranslations) => getDashboardTranslation(lang, key);
  const ct = (key: keyof CommonTranslations) => getCommonTranslation(lang, key);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [lightboxViewport, setLightboxViewport] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gridColumns, setGridColumns] = useState(3);
  const [viewMode, setViewMode] = useState<'latest' | 'byDate'>('latest');

  // 사진 장수: 1~11→1열, 12~39→3열, 40+→5열. 줌인/줌아웃 시 5↔3↔1 순서 유지.
  // 비율을 보수적으로 해서 좌우 잘림 없이 다 보인 뒤에만 다음 열 단계로 전환.
  const ZOOM_THRESHOLD = 0.92;
  const RATIO_1COL = 0.52;
  const RATIO_3COL = 0.65;
  const RATIO_3TO1_HYST = 0.45;
  const baseWidthRef = useRef(0);
  const prevColsRef = useRef(5);
  const justSteppedFromFiveRef = useRef(false);
  const lightboxOpenRef = useRef(false);
  const headerRef = useRef<HTMLElement>(null);
  const headerRefWidthRef = useRef<number>(0);
  const [viewportWidth, setViewportWidth] = useState<number>(1200);
  const [headerScale, setHeaderScale] = useState<number>(1);
  lightboxOpenRef.current = selectedIndex !== null;
  useEffect(() => {
    let rafId: number | undefined;
    const updateColumns = () => {
      rafId = requestAnimationFrame(() => {
        rafId = undefined;
        if (typeof window === 'undefined') return;
        if (lightboxOpenRef.current) return;
        const n = album.length;
        const photoBasedCols = n <= 11 ? 1 : n < 40 ? 3 : 5;
        const vv = window.visualViewport;
        const visualW = vv ? vv.width : window.innerWidth;
        const innerW = window.innerWidth;
        if (baseWidthRef.current === 0) {
          baseWidthRef.current = Math.max(innerW, visualW, 400);
        }
        const base = baseWidthRef.current;
        const isZoomedIn = base > 0 && visualW < base * ZOOM_THRESHOLD;
        const viewportCols = isZoomedIn
          ? (visualW < base * RATIO_1COL ? 1 : visualW < base * RATIO_3COL ? 3 : 5)
          : 5;
        let cols = isZoomedIn
          ? Math.min(viewportCols, photoBasedCols)
          : photoBasedCols;
        const prev = prevColsRef.current;
        if (prev === 5 && cols === 1) {
          cols = 3;
          justSteppedFromFiveRef.current = true;
        } else if (prev === 3 && cols === 1 && justSteppedFromFiveRef.current) {
          cols = 3;
          justSteppedFromFiveRef.current = false;
        } else if (prev === 3 && cols === 1) {
          cols = visualW < base * RATIO_3TO1_HYST ? 1 : 3;
        } else if (prev === 1 && cols === 5) {
          cols = 3;
        } else if (prev === 3 && cols === 5) {
          cols = visualW >= base * RATIO_3COL ? 5 : 3;
        }
        if (cols !== 3) justSteppedFromFiveRef.current = false;
        prevColsRef.current = cols;
        setGridColumns(cols);
        setViewportWidth(visualW);
      });
    };
    updateColumns();
    window.addEventListener('resize', updateColumns);
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (vv) {
      vv.addEventListener('resize', updateColumns);
      vv.addEventListener('scroll', updateColumns);
    }
    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateColumns);
      if (vv) {
        vv.removeEventListener('resize', updateColumns);
        vv.removeEventListener('scroll', updateColumns);
      }
    };
  }, [album.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;
    const centerScrollOnResize = () => {
      if (lightboxOpenRef.current) return;
      const doc = document.documentElement;
      const pageCenterX = doc.scrollWidth / 2;
      const targetX = pageCenterX - vv.width / 2;
      const clampX = Math.max(0, Math.min(targetX, doc.scrollWidth - vv.width));
      window.scrollTo(clampX, window.scrollY);
    };
    vv.addEventListener('resize', centerScrollOnResize);
    return () => vv.removeEventListener('resize', centerScrollOnResize);
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const refWidthRef = headerRefWidthRef;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0 && refWidthRef.current === 0) refWidthRef.current = w;
      if (refWidthRef.current > 0) {
        const scale = w / refWidthRef.current;
        setHeaderScale(Math.min(1, Math.max(0.5, scale)));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (selectedIndex === null || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setLightboxViewport({
        top: vv.offsetTop,
        left: vv.offsetLeft,
        width: vv.width,
        height: vv.height,
      });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setLightboxViewport({ top: 0, left: 0, width: 0, height: 0 });
    };
  }, [selectedIndex]);

  type Photo = import('@/app/contexts/AlbumContext').Photo;
  const groupedByDate = React.useMemo(() => {
    const groups = new Map<string, Photo[]>();
    const noDateKey = '__no_date__';
    for (const p of album) {
      const t = p.taken_at;
      let key: string;
      let label: string;
      if (t) {
        try {
          const d = new Date(t);
          if (isNaN(d.getTime())) {
            key = noDateKey;
            label = lang === 'ko' ? '날짜 없음' : 'No date';
          } else {
            key = t.slice(0, 10);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const day = d.getDate();
            label = lang === 'ko' ? `${y}년 ${m}월 ${day}일` : `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        } catch {
          key = noDateKey;
          label = lang === 'ko' ? '날짜 없음' : 'No date';
        }
      } else {
        key = noDateKey;
        label = lang === 'ko' ? '날짜 없음' : 'No date';
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    const noDatePhotos = groups.get(noDateKey) || [];
    groups.delete(noDateKey);
    const sortedKeys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));
    const sections: { dateKey: string; label: string; photos: Photo[] }[] = [];
    for (const k of sortedKeys) {
      const d = new Date(k);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const day = d.getDate();
      const label = lang === 'ko' ? `${y}년 ${m}월 ${day}일` : `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      sections.push({ dateKey: k, label, photos: groups.get(k)! });
    }
    if (noDatePhotos.length) {
      sections.push({
        dateKey: noDateKey,
        label: lang === 'ko' ? '날짜 없음' : 'No date',
        photos: noDatePhotos,
      });
    }
    return sections;
  }, [album, lang]);

  const displayListForLightbox: Photo[] = viewMode === 'byDate'
    ? groupedByDate.flatMap((s) => s.photos)
    : album;

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
    const takenAt = parseTakenAtFromFilename(uploadFileName);
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
              taken_at: takenAt ?? undefined,
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
                  taken_at: takenAt ?? undefined,
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

  const openLightbox = (index: number) => {
    setEditingId(null);
    setSelectedIndex(index);
  };
  const closeLightbox = () => setSelectedIndex(null);

  const mainMaxWidth = Math.min(1200, viewportWidth);

  return (
    <div className="memories-page" style={{ minHeight: '100vh', width: '100%', maxWidth: '100vw', overflowX: 'clip', background: 'var(--bg-dashboard, #f8fafc)', paddingBottom: 80 }}>
      <header
        ref={headerRef}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          width: '100%',
          maxWidth: `min(${mainMaxWidth}px, 100vw)`,
          margin: '0 auto',
          boxSizing: 'border-box',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          padding: `${12 * headerScale}px ${16 * headerScale}px`,
          display: 'flex',
          alignItems: 'center',
          gap: 12 * headerScale,
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
            borderRadius: 8 * headerScale,
            width: 40 * headerScale,
            height: 40 * headerScale,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#fff',
          }}
        >
          <ChevronLeft size={Math.round(24 * headerScale)} />
        </button>
        <h1 style={{ flex: 1, margin: 0, fontSize: `${1.25 * headerScale}rem`, fontWeight: 700 }}>
          {dt('section_title_memories')}
        </h1>
        <label
          htmlFor="memories-file-input"
          style={{
            padding: `${8 * headerScale}px ${16 * headerScale}px`,
            background: 'rgba(255,255,255,0.25)',
            borderRadius: 8 * headerScale,
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14 * headerScale,
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

      <main
        style={{
          padding: 16,
          width: '100%',
          maxWidth: `min(${mainMaxWidth}px, 100vw)`,
          margin: '0 auto',
          boxSizing: 'border-box',
          overflowX: 'clip',
          minWidth: 0,
        }}
      >
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
          <>
            <div style={{ display: 'flex', gap: 8 * headerScale, marginBottom: 16 * headerScale }}>
              <button
                type="button"
                onClick={() => setViewMode('latest')}
                style={{
                  padding: `${8 * headerScale}px ${14 * headerScale}px`,
                  borderRadius: 8 * headerScale,
                  border: viewMode === 'latest' ? '2px solid #667eea' : '1px solid #e2e8f0',
                  background: viewMode === 'latest' ? '#eef2ff' : '#fff',
                  color: viewMode === 'latest' ? '#4338ca' : '#64748b',
                  fontWeight: 600,
                  fontSize: 14 * headerScale,
                  cursor: 'pointer',
                }}
              >
                {lang === 'ko' ? '최신순' : 'Latest'}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('byDate')}
                style={{
                  padding: `${8 * headerScale}px ${14 * headerScale}px`,
                  borderRadius: 8 * headerScale,
                  border: viewMode === 'byDate' ? '2px solid #667eea' : '1px solid #e2e8f0',
                  background: viewMode === 'byDate' ? '#eef2ff' : '#fff',
                  color: viewMode === 'byDate' ? '#4338ca' : '#64748b',
                  fontWeight: 600,
                  fontSize: 14 * headerScale,
                  cursor: 'pointer',
                }}
              >
                {lang === 'ko' ? '촬영일별 보기' : 'By date taken'}
              </button>
            </div>
            {viewMode === 'latest' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
              gap: 12,
              minWidth: 0,
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
                  <div
                    style={{
                      aspectRatio: gridColumns === 1 ? undefined : '4/3',
                      background: '#f1f5f9',
                      position: 'relative',
                      ...(gridColumns === 1 ? { width: '100%' } : {}),
                    }}
                  >
                    <img
                      src={p.data}
                      alt=""
                      style={{
                        width: '100%',
                        height: gridColumns === 1 ? 'auto' : '100%',
                        objectFit: gridColumns === 1 ? 'contain' : 'cover',
                        display: 'block',
                        ...(gridColumns === 1 ? { maxWidth: '100%', verticalAlign: 'top' } : {}),
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
              </motion.div>
            ))}
          </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {groupedByDate.map((section) => (
                  <section key={section.dateKey}>
                    <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#334155' }}>
                      {section.label} ({section.photos.length}{lang === 'ko' ? '장' : ''})
                    </h2>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                        gap: 12,
                        minWidth: 0,
                      }}
                    >
                      {section.photos.map((p) => {
                        const globalIndex = displayListForLightbox.findIndex((x) => String(x.id) === String(p.id));
                        return (
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
                              onClick={() => openLightbox(globalIndex >= 0 ? globalIndex : 0)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(globalIndex >= 0 ? globalIndex : 0); } }}
                              style={{ cursor: 'pointer', position: 'relative' }}
                            >
                              <div
                                style={{
                                  aspectRatio: gridColumns === 1 ? undefined : '4/3',
                                  background: '#f1f5f9',
                                  position: 'relative',
                                  ...(gridColumns === 1 ? { width: '100%' } : {}),
                                }}
                              >
                                <img
                                  src={p.data}
                                  alt=""
                                  style={{
                                    width: '100%',
                                    height: gridColumns === 1 ? 'auto' : '100%',
                                    objectFit: gridColumns === 1 ? 'contain' : 'cover',
                                    display: 'block',
                                    ...(gridColumns === 1 ? { maxWidth: '100%', verticalAlign: 'top' } : {}),
                                  }}
                                />
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <AnimatePresence>
        {selectedIndex !== null && displayListForLightbox[selectedIndex] && (() => {
          const layoutW = typeof window !== 'undefined' ? window.innerWidth : 0;
          const layoutH = typeof window !== 'undefined' ? window.innerHeight : 0;
          const vv = typeof window !== 'undefined' && window.visualViewport ? window.visualViewport : null;
          const vvValid = vv && typeof vv.width === 'number' && vv.width > 0;
          const vLeft = vvValid ? vv!.offsetLeft - (layoutW - vv!.width) / 2 : 0;
          const vTop = vvValid ? vv!.offsetTop - (layoutH - vv!.height) / 2 : 0;
          const fromState = lightboxViewport.width > 0;
          const left = vvValid ? vLeft : (fromState ? lightboxViewport.left - (layoutW - lightboxViewport.width) / 2 : 0);
          const top = vvValid ? vTop : (fromState ? lightboxViewport.top - (layoutH - lightboxViewport.height) / 2 : 0);
          return (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top,
              left,
              width: layoutW,
              height: layoutH,
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
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(dt('photo_delete_confirm'))) {
                  deletePhoto(displayListForLightbox[selectedIndex].id);
                  setEditingId(null);
                  setEditDescription('');
                  closeLightbox();
                }
              }}
              aria-label={ct('delete') || '삭제'}
              title={ct('delete')}
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                background: 'rgba(239,68,68,0.9)',
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
              <Trash2 size={20} />
            </button>
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
                minWidth: 0,
                width: '100%',
                maxWidth: '100%',
                maxHeight: '100%',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent: 'center',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={displayListForLightbox[selectedIndex].data}
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: 8,
                  display: 'block',
                }}
              />
            </div>
            <div
              style={{
                flexShrink: 0,
                marginTop: 12,
                width: '100%',
                maxWidth: 400,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {editingId === displayListForLightbox[selectedIndex].id ? (
                <>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder={dt('photo_description_placeholder')}
                    style={{
                      width: '100%',
                      padding: 10,
                      border: '1px solid rgba(255,255,255,0.5)',
                      borderRadius: 8,
                      fontSize: 14,
                      background: 'rgba(255,255,255,0.1)',
                      color: '#fff',
                    }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        updatePhotoDescription({
                          photoId: displayListForLightbox[selectedIndex].id,
                          description: editDescription,
                        });
                        setEditingId(null);
                        setEditDescription('');
                      }}
                      style={{
                        padding: '8px 16px',
                        background: '#6366f1',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 14,
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
                        padding: '8px 16px',
                        background: 'rgba(255,255,255,0.2)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {ct('cancel')}
                    </button>
                  </div>
                </>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setEditingId(displayListForLightbox[selectedIndex].id);
                    setEditDescription(displayListForLightbox[selectedIndex].description || '');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setEditingId(displayListForLightbox[selectedIndex].id);
                      setEditDescription(displayListForLightbox[selectedIndex].description || '');
                    }
                  }}
                  style={{
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: 14,
                    textAlign: 'center',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: 4,
                  }}
                >
                  {displayListForLightbox[selectedIndex].description || dt('photo_description_hint')}
                </div>
              )}
            </div>
          </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
