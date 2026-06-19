'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { ChevronLeft, X, Trash2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGroup } from '@/app/contexts/GroupContext';
import { useAlbum } from '@/app/contexts/AlbumContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getDashboardTranslation, type DashboardTranslations } from '@/lib/translations/dashboard';
import { getCommonTranslation, type CommonTranslations } from '@/lib/translations/common';
import { intlLocaleForLang, type LangCode } from '@/lib/language-fonts';
import imageCompression from 'browser-image-compression';
import {
  getDisplayImageData,
  getMimeTypeFromExtension,
  isRawFileExtension,
} from '@/lib/photo-upload-utils';
import { supabase } from '@/lib/supabase';
import * as exifr from 'exifr';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB 통일
const COMPRESSION_OPTIONS = {
  maxSizeMB: 3,
  maxWidthOrHeight: 2560,
  initialQuality: 0.9,
};

/** 이 길이를 넘는 압축/원본 라벨은 헤더에서 세로 배치 (예: Compressed / Original) */
const UPLOAD_MODE_LABEL_STACK_MAX_LEN = 7;

function formatMemorySectionDate(date: Date, lang: LangCode): string {
  return new Intl.DateTimeFormat(intlLocaleForLang(lang), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/** 프록시 URL에서 s3 key 추출 (진단 링크용). 없으면 null */
function getDiagnoseKeyFromData(data: string): string | null {
  if (!data || !data.includes('/api/photo/proxy')) return null;
  try {
    const u = data.startsWith('http') ? new URL(data) : new URL(data, 'https://a');
    return u.searchParams.get('key');
  } catch {
    return null;
  }
}

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

/** EXIF 데이터에서 촬영 날짜 추출. ISO 문자열 또는 null */
async function extractTakenAtFromExif(file: File): Promise<string | null> {
  try {
    // EXIF 데이터 읽기 (DateTimeOriginal, DateTime, CreateDate 순으로 시도)
    const exif = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'DateTime', 'CreateDate'],
    });
    
    if (!exif) return null;
    
    // DateTimeOriginal이 가장 정확한 촬영 날짜
    const dateValue = exif.DateTimeOriginal || exif.DateTime || exif.CreateDate;
    
    if (!dateValue) return null;
    
    // Date 객체로 변환 (exifr이 이미 Date 객체로 변환해줌)
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    
    if (isNaN(date.getTime())) return null;
    
    return date.toISOString();
  } catch (error) {
    // EXIF 데이터가 없거나 읽기 실패 시 null 반환
    if (process.env.NODE_ENV === 'development') {
      console.log('EXIF 읽기 실패:', error);
    }
    return null;
  }
}

/** 사진 촬영 날짜 추출 (EXIF 우선, 파일명 보조). ISO 문자열 또는 null */
async function extractTakenAt(file: File): Promise<string | null> {
  // 1순위: EXIF 데이터에서 추출
  const exifDate = await extractTakenAtFromExif(file);
  if (exifDate) return exifDate;
  
  // 2순위: 파일명에서 추출
  const filenameDate = parseTakenAtFromFilename(file.name);
  if (filenameDate) return filenameDate;
  
  // 둘 다 없으면 null
  return null;
}

export default function MemoriesPage() {
  const { currentGroupId } = useGroup();
  const { album, addPhoto, deletePhoto, updatePhotoDescription, updatePhotoId } = useAlbum();
  const { lang } = useLanguage();
  const dt = (key: keyof DashboardTranslations) => getDashboardTranslation(lang, key);
  const ct = (key: keyof CommonTranslations) => getCommonTranslation(lang, key);
  const uploadModeCompressedLabel = dt('memories_mode_compressed');
  const uploadModeOriginalLabel = dt('memories_mode_original');
  const stackUploadModeOptions = useMemo(
    () =>
      Math.max(uploadModeCompressedLabel.length, uploadModeOriginalLabel.length) >
      UPLOAD_MODE_LABEL_STACK_MAX_LEN,
    [uploadModeCompressedLabel, uploadModeOriginalLabel],
  );

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [lightboxViewport, setLightboxViewport] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gridColumns, setGridColumns] = useState(3);
  const [viewMode, setViewMode] = useState<'latest' | 'byDate'>('latest');
  const [uploadMode, setUploadMode] = useState<'normal' | 'original'>('normal');
  /** 이미지 로드 실패한 사진 id (진단 링크 표시용). 문자열로 통일해 비교 */
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const markImageFailed = (id: string | number) =>
    setFailedImageIds((prev) => new Set(prev).add(String(id)));
  /** 이미지 로드 완료된 id → 페이드인 표시용 */
  const [imageLoadedIds, setImageLoadedIds] = useState<Set<string>>(new Set());
  const markImageLoaded = (id: string | number) =>
    setImageLoadedIds((prev) => new Set(prev).add(String(id)));

  const lightboxOpenRef = useRef(false);
  /** 라이트박스 열릴 때 뷰포트 크기 고정 → 줌인 시에도 사진이 작아지지 않음 */
  const lightboxSizeRef = useRef<{ w: number; h: number } | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const headerRefWidthRef = useRef<number>(0);
  const [headerScale, setHeaderScale] = useState<number>(1);
  const [viewportWidth, setViewportWidth] = useState<number>(1200);
  lightboxOpenRef.current = selectedIndex !== null;
  if (selectedIndex === null) lightboxSizeRef.current = null;
  useEffect(() => {
    let rafId: number | undefined;
    const updateColumns = () => {
      rafId = requestAnimationFrame(() => {
        rafId = undefined;
        if (typeof window === 'undefined') return;
        if (lightboxOpenRef.current) return;
        const n = album.length;
        const vv = window.visualViewport;
        const visualW = vv ? vv.width : window.innerWidth;
        setViewportWidth(visualW);
        // 아이폰 사진처럼: 뷰포트만으로 열 수, 390px에서도 줌아웃 시 5~6열
        const viewportCols = visualW < 200 ? 1 : visualW < 260 ? 2 : visualW < 320 ? 3 : visualW < 380 ? 4 : visualW < 440 ? 5 : visualW < 520 ? 6 : 7;
        const cols = n <= 11 ? 1 : viewportCols;
        setGridColumns(cols);
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
    const noDateLabel = getDashboardTranslation(lang, 'memories_no_date');
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
            label = noDateLabel;
          } else {
            key = t.slice(0, 10);
            label = formatMemorySectionDate(d, lang);
          }
        } catch {
          key = noDateKey;
          label = noDateLabel;
        }
      } else {
        key = noDateKey;
        label = noDateLabel;
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
      const label = formatMemorySectionDate(d, lang);
      sections.push({ dateKey: k, label, photos: groups.get(k)! });
    }
    if (noDatePhotos.length) {
      sections.push({
        dateKey: noDateKey,
        label: noDateLabel,
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
    if (file.size > MAX_FILE_SIZE) {
      alert(`파일이 20MB를 초과합니다. (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      e.target.value = '';
      return;
    }
    if (!currentGroupId) {
      alert(dt('group_info_missing'));
      e.target.value = '';
      return;
    }
    const isRawFile = isRawFileExtension(ext);
    const effectiveMode = isRawFile ? 'original' as const : uploadMode;
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
    const takenAt = await extractTakenAt(file);
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
      const authHeader = () => ({ Authorization: `Bearer ${session.access_token}` });

      let bodyToPut: Blob;
      let fileNameForUpload = uploadFileName;
      let mimeTypeForUpload = uploadMimeType;
      let fileSizeForUpload = uploadFileSize;

      if (effectiveMode === 'normal' && !isRawFile && mimeType.startsWith('image/')) {
        const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
        bodyToPut = compressed;
        const ext = compressed.name.split('.').pop()?.toLowerCase() || 'jpg';
        fileNameForUpload = uploadFileName.replace(/\.[^.]+$/i, `.${ext}`);
        mimeTypeForUpload = compressed.type || 'image/jpeg';
        fileSizeForUpload = compressed.size;
      } else {
        bodyToPut = file;
      }

      try {
        const urlController = new AbortController();
        const urlTimeout = setTimeout(() => urlController.abort(), 10000);
        const urlRes = await fetch('/api/get-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({
            fileName: fileNameForUpload,
            mimeType: mimeTypeForUpload,
            fileSize: fileSizeForUpload,
            groupId: currentGroupId,
            upload_mode: effectiveMode,
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
          body: bodyToPut,
          headers: { 'Content-Type': mimeTypeForUpload },
        });
        if (!putRes.ok) throw new Error('S3 직접 업로드 실패');
        const completeController = new AbortController();
        const completeTimeout = setTimeout(() => completeController.abort(), 60000);
        const completeRes = await fetch('/api/complete-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({
            s3Key,
            s3Url,
            fileName: fileNameForUpload,
            mimeType: mimeTypeForUpload,
            originalSize: effectiveMode === 'original' ? uploadFileSize : fileSizeForUpload,
            groupId: currentGroupId,
            upload_mode: effectiveMode,
            taken_at: takenAt ?? undefined,
          }),
          signal: completeController.signal,
        });
        clearTimeout(completeTimeout);
        const completeResult = await completeRes.json();
        if (completeRes.ok && completeResult.id && completeResult.s3Url) {
          updatePhotoId({
            oldId: photoId,
            newId: completeResult.id,
            s3Url: completeResult.s3Url,
          });
          uploadCompleted = true;
        } else if (completeRes.ok) {
          updatePhotoId({
            oldId: photoId,
            newId: photoId,
            s3Url: s3Url,
          });
          uploadCompleted = true;
        } else {
          updatePhotoId({ oldId: photoId, newId: photoId, s3Url: s3Url });
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
                fileName: uploadFileName,
                mimeType: uploadMimeType,
                originalSize: uploadFileSize,
                groupId: currentGroupId,
                upload_mode: effectiveMode,
                taken_at: takenAt ?? undefined,
              }),
            });
            const fallbackResult = await fallbackRes.json();
            if (fallbackRes.ok && fallbackResult.id && fallbackResult.s3Url) {
              updatePhotoId({
                oldId: photoId,
                newId: fallbackResult.id,
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
      if (errorMessage.includes('AWS_S3_BUCKET_NAME') || errorMessage.includes('S3 환경 변수')) {
        failureReason = 'S3 환경 변수가 설정되지 않았습니다.\n\n필요한 환경 변수:\n- AWS_S3_BUCKET_NAME\n- AWS_ACCESS_KEY_ID\n- AWS_SECRET_ACCESS_KEY\n- AWS_REGION\n\n.env.local 파일과 Vercel 환경 변수에 설정해주세요.';
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
    <div className="memories-page min-h-screen w-full max-w-[100vw] overflow-x-clip bg-[var(--surface-base)] pb-20">
      <header
        ref={headerRef}
        className="sticky top-0 z-50 mx-auto box-border flex w-full items-center bg-[linear-gradient(135deg,rgb(var(--brand-primary))_0%,rgb(var(--brand-secondary))_100%)] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] [max-width:var(--memories-header-max-width)] [padding:var(--memories-header-padding)] [gap:var(--memories-header-gap)]"
        style={{
          ['--hs' as any]: headerScale,
          ['--memories-header-max-width' as any]: `min(${mainMaxWidth}px, 100vw)`,
          ['--memories-header-padding' as any]: `${12 * headerScale}px ${16 * headerScale}px`,
          ['--memories-header-gap' as any]: `${12 * headerScale}px`,
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          aria-label={ct('back') || '뒤로'}
          className="flex h-[calc(40px*var(--hs))] w-[calc(40px*var(--hs))] cursor-pointer items-center justify-center rounded-[calc(8px*var(--hs))] border-none bg-white/20 text-white"
        >
          <ChevronLeft size={Math.round(24 * headerScale)} />
        </button>
        <h1 className="m-0 flex-1 text-[calc(1.25rem*var(--hs))] font-bold">
          {dt('section_title_memories')}
        </h1>
        <div className="flex shrink-0 flex-col gap-[calc(6px*var(--hs))]">
          <span className="text-[calc(12px*var(--hs))] text-white/90">
            {dt('memories_upload_label')}
          </span>
          <div
            className={`flex gap-[calc(6px*var(--hs))] ${
              stackUploadModeOptions
                ? 'flex-col items-start'
                : 'flex-row flex-wrap items-center'
            }`}
          >
            <label className="flex cursor-pointer items-center gap-[calc(6px*var(--hs))] whitespace-nowrap text-[calc(13px*var(--hs))] leading-tight">
              <input
                type="radio"
                name="uploadMode"
                checked={uploadMode === 'normal'}
                onChange={() => setUploadMode('normal')}
                className="h-[14px] w-[14px] shrink-0"
              />
              {uploadModeCompressedLabel}
            </label>
            <label className="flex cursor-pointer items-center gap-[calc(6px*var(--hs))] whitespace-nowrap text-[calc(13px*var(--hs))] leading-tight">
              <input
                type="radio"
                name="uploadMode"
                checked={uploadMode === 'original'}
                onChange={() => setUploadMode('original')}
                className="h-[14px] w-[14px] shrink-0"
              />
              {uploadModeOriginalLabel}
            </label>
          </div>
        </div>
        <label
          htmlFor="memories-file-input"
          className="cursor-pointer rounded-[calc(8px*var(--hs))] bg-white/25 px-[calc(16px*var(--hs))] py-[calc(8px*var(--hs))] text-[calc(14px*var(--hs))] font-semibold"
        >
          {dt('photo_upload_btn')}
        </label>
        <input
          id="memories-file-input"
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif,.raw,.cr2,.nef,.arw,.orf,.rw2,.dng,.raf,.srw"
          className="hidden"
          onChange={handleFileSelect}
        />
      </header>

      <main
        className={`mx-auto box-border w-full min-w-0 overflow-x-clip p-4 max-w-[min(${mainMaxWidth}px,100vw)]`}
      >
        {album.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="glass-panel-soft glass-panel-interactive cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-12 text-center text-slate-400"
          >
            <div className="mb-3 text-5xl">📷</div>
            <div>{dt('photo_upload_prompt')}</div>
          </div>
        ) : (
          <>
            <div className="mb-[calc(16px*var(--hs))] flex gap-[calc(8px*var(--hs))]">
              <button
                type="button"
                onClick={() => setViewMode('latest')}
                className={`cursor-pointer rounded-[calc(8px*var(--hs))] px-[calc(14px*var(--hs))] py-[calc(8px*var(--hs))] text-[calc(14px*var(--hs))] font-semibold ${viewMode === 'latest' ? 'border-2 border-indigo-500 bg-indigo-50 text-indigo-700' : 'border border-slate-200 bg-white text-slate-500'}`}
              >
                {dt('memories_sort_latest')}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('byDate')}
                className={`cursor-pointer rounded-[calc(8px*var(--hs))] px-[calc(14px*var(--hs))] py-[calc(8px*var(--hs))] text-[calc(14px*var(--hs))] font-semibold ${viewMode === 'byDate' ? 'border-2 border-indigo-500 bg-indigo-50 text-indigo-700' : 'border border-slate-200 bg-white text-slate-500'}`}
              >
                {dt('memories_sort_by_date')}
              </button>
            </div>
            {viewMode === 'latest' ? (
          <div className={`grid min-w-0 gap-2 [grid-template-columns:repeat(${gridColumns},minmax(0,1fr))]`}>
            {album.map((p, index) => (
              <motion.div
                key={p.id}
                layout="position"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ layout: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } }}
                className="memory-card glass-panel-soft glass-panel-interactive overflow-hidden rounded-xl"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openLightbox(index)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(index); } }}
                  className="relative cursor-pointer"
                >
                    <div
                      className={`relative bg-slate-100 ${gridColumns === 1 ? 'w-full' : 'aspect-[4/3]'}`}
                    >
                    <img
                      src={p.data}
                      alt=""
                      loading={index < 8 ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchPriority={index < 4 ? 'high' : undefined}
                      onError={() => markImageFailed(p.id)}
                      onLoad={(e) => {
                        if (getDiagnoseKeyFromData(p.data) && (e.target as HTMLImageElement).naturalWidth === 0) {
                          markImageFailed(p.id);
                        } else {
                          markImageLoaded(p.id);
                        }
                      }}
                      className={`block w-full transition-opacity duration-200 ease-out ${
                        gridColumns === 1
                          ? 'h-auto max-w-full align-top object-contain'
                          : 'h-full object-cover'
                      } ${imageLoadedIds.has(String(p.id)) ? 'opacity-100' : 'opacity-0'}`}
                    />
                    {failedImageIds.has(String(p.id)) && getDiagnoseKeyFromData(p.data) && (
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 p-3 text-center text-xs text-white"
                      >
                        <span>{dt('memories_image_load_failed')}</span>
                        <a
                          href={`/api/photo/diagnose?key=${encodeURIComponent(getDiagnoseKeyFromData(p.data)!)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-300 underline"
                        >
                          {dt('memories_diagnose_link')}
                        </a>
                      </div>
                    )}
                    {p.isUploading && (
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-black/50 font-semibold text-white"
                      >
                        {dt('memories_uploading')}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
            ) : (
              <div className="flex flex-col gap-6">
                {groupedByDate.map((section) => (
                  <section key={section.dateKey}>
                    <h2 className="mb-3 mt-0 text-base font-bold text-slate-700">
                      {section.label} ({section.photos.length}{dt('memories_photo_count_suffix')})
                    </h2>
                    <div
                      className={`grid min-w-0 gap-2 [grid-template-columns:repeat(${gridColumns},minmax(0,1fr))]`}
                    >
                      {section.photos.map((p) => {
                        const globalIndex = displayListForLightbox.findIndex((x) => String(x.id) === String(p.id));
                        return (
                          <motion.div
                            key={p.id}
                            layout="position"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ layout: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } }}
                            className="memory-card glass-panel-soft glass-panel-interactive overflow-hidden rounded-xl"
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => openLightbox(globalIndex >= 0 ? globalIndex : 0)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(globalIndex >= 0 ? globalIndex : 0); } }}
                              className="relative cursor-pointer"
                            >
                              <div
                                className={`relative bg-slate-100 ${gridColumns === 1 ? 'w-full' : 'aspect-[4/3]'}`}
                              >
                                <img
                                  src={p.data}
                                  alt=""
                                  loading={section.photos.indexOf(p) < 8 ? 'eager' : 'lazy'}
                                  decoding="async"
                                  onError={() => markImageFailed(p.id)}
                                  onLoad={(e) => {
                                    if (getDiagnoseKeyFromData(p.data) && (e.target as HTMLImageElement).naturalWidth === 0) {
                                      markImageFailed(p.id);
                                    } else {
                                      markImageLoaded(p.id);
                                    }
                                  }}
                                  className={`block w-full transition-opacity duration-200 ease-out ${
                                    gridColumns === 1
                                      ? 'h-auto max-w-full align-top object-contain'
                                      : 'h-full object-cover'
                                  } ${imageLoadedIds.has(String(p.id)) ? 'opacity-100' : 'opacity-0'}`}
                                />
                                {failedImageIds.has(String(p.id)) && getDiagnoseKeyFromData(p.data) && (
                                  <div
                                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 p-3 text-center text-xs text-white"
                                  >
                                    <span>{dt('memories_image_load_failed')}</span>
                                    <a
                                      href={`/api/photo/diagnose?key=${encodeURIComponent(getDiagnoseKeyFromData(p.data)!)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-300 underline"
                                    >
                                      {dt('memories_diagnose_link')}
                                    </a>
                                  </div>
                                )}
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
          const vv = typeof window !== 'undefined' && window.visualViewport ? window.visualViewport : null;
          if (typeof window !== 'undefined' && vv && !lightboxSizeRef.current) {
            lightboxSizeRef.current = { w: vv.width, h: vv.height };
          }
          const sizeW = lightboxSizeRef.current?.w ?? (typeof window !== 'undefined' ? window.innerWidth : 0);
          const sizeH = lightboxSizeRef.current?.h ?? (typeof window !== 'undefined' ? window.innerHeight : 0);
          const vvValid = vv && typeof vv.width === 'number' && vv.width > 0;
          const vLeft = vvValid ? vv!.offsetLeft - (sizeW - vv!.width) / 2 : 0;
          const vTop = vvValid ? vv!.offsetTop - (sizeH - vv!.height) / 2 : 0;
          return (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed z-[10000] box-border flex flex-col items-stretch bg-black/[0.95] p-0 [top:var(--lightbox-top)] [left:var(--lightbox-left)] [width:var(--lightbox-width)] [height:var(--lightbox-height)]"
            style={{
              ['--lightbox-top' as any]: `${vvValid ? vTop : 0}px`,
              ['--lightbox-left' as any]: `${vvValid ? vLeft : 0}px`,
              ['--lightbox-width' as any]: `${sizeW}px`,
              ['--lightbox-height' as any]: `${sizeH}px`,
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
              className="absolute left-3 top-3 z-[1] flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-none bg-red-500/90 text-white"
            >
              <Trash2 size={20} />
            </button>
            {displayListForLightbox[selectedIndex].supabaseId && (() => {
              const photo = displayListForLightbox[selectedIndex];
              const modeLabel = photo.upload_mode === 'original' ? dt('memories_mode_original') : dt('memories_mode_compressed');
              const downloadLabel = `${dt('photo_download')} (${modeLabel})`;
              return (
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.access_token) {
                      alert(dt('photo_download_auth_required'));
                      return;
                    }
                    const id = String(photo.supabaseId ?? photo.id);
                    const res = await fetch(`/api/photo/download?id=${encodeURIComponent(id)}`, {
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    });
                    if (!res.ok) {
                      const j = await res.json().catch(() => ({}));
                      alert(j?.error || dt('photo_download_failed'));
                      return;
                    }
                    const blob = await res.blob();
                    const disp = res.headers.get('Content-Disposition');
                    const match = disp && /filename\*?=(?:UTF-8'')?([^;]+)|filename="?([^";]+)"?/i.exec(disp);
                    const filename = (match && (decodeURIComponent(match[1]?.replace(/^"|"$/g, '') || '') || match[2]?.replace(/^"|"$/g, ''))) || `photo-${id}.jpg`;
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  } catch (err) {
                    console.error(err);
                    alert(dt('photo_download_failed'));
                  }
                }}
                aria-label={downloadLabel}
                title={downloadLabel}
                className="absolute left-[60px] top-3 z-[1] flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-none bg-white/20 text-white"
              >
                <Download size={20} />
              </button>
              );
            })()}
            <button
              type="button"
              onClick={closeLightbox}
              aria-label={ct('close') || '닫기'}
              className="absolute right-3 top-3 z-[1] flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-none bg-white/20 text-white"
            >
              <X size={24} />
            </button>
            <div
              className="absolute inset-0 flex items-center justify-center p-3 box-border"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={displayListForLightbox[selectedIndex].data}
                alt=""
                onLoad={() => markImageLoaded(displayListForLightbox[selectedIndex].id)}
                className={`block h-auto w-auto max-h-full max-w-full rounded object-contain transition-opacity duration-200 ease-out ${
                  imageLoadedIds.has(String(displayListForLightbox[selectedIndex].id)) ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </div>
            <div
              className="absolute inset-x-0 bottom-0 mx-auto box-border flex max-w-[400px] flex-col items-center gap-2 bg-gradient-to-b from-transparent to-black/70 px-4 py-3"
              onClick={(e) => e.stopPropagation()}
            >
              {editingId === displayListForLightbox[selectedIndex].id ? (
                <>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder={dt('photo_description_placeholder')}
                    className="w-full rounded-lg border border-white/50 bg-white/10 p-2.5 text-sm text-white"
                    autoFocus
                  />
                  <div className="flex flex-wrap justify-center gap-2">
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
                      className="cursor-pointer rounded-md border-none bg-indigo-500 px-4 py-2 text-sm font-semibold text-white"
                    >
                      {ct('save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditDescription('');
                      }}
                      className="cursor-pointer rounded-md border-none bg-white/20 px-4 py-2 text-sm font-semibold text-white"
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
                  className="cursor-pointer text-center text-sm text-white/90 underline underline-offset-4"
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
