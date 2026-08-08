'use client';

import React, { useRef, useState } from 'react';
import type { PictureFindDiffMode, PictureFindScene } from '@/lib/picture-find/types';
import { createPictureFindSceneFromUpload } from '@/lib/picture-find/upload-scene';
import type { PictureFindTranslations } from '@/lib/translations/picture-find';

export type PictureFindUploadPanelProps = {
  groupId: string | null;
  t: PictureFindTranslations;
  onCreated: (scene: PictureFindScene) => void;
  onCancel: () => void;
};

export function PictureFindUploadPanel({ groupId, t, onCreated, onCancel }: PictureFindUploadPanelProps) {
  const [title, setTitle] = useState('');
  const [diffMode, setDiffMode] = useState<PictureFindDiffMode>('auto');
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [variantFile, setVariantFile] = useState<File | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [variantPreview, setVariantPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const variantRef = useRef<HTMLInputElement>(null);
  const pickTarget = useRef<'original' | 'variant'>('original');

  const assignFile = (file: File | null, target: 'original' | 'variant') => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (target === 'original') {
      if (originalPreview) URL.revokeObjectURL(originalPreview);
      setOriginalFile(file);
      setOriginalPreview(url);
    } else {
      if (variantPreview) URL.revokeObjectURL(variantPreview);
      setVariantFile(file);
      setVariantPreview(url);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!groupId) {
      setError(t.upload_need_group);
      return;
    }
    if (!originalFile) {
      setError(t.upload_need_original);
      return;
    }
    if (diffMode === 'manual' && !variantFile) {
      setError(t.upload_need_variant);
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const scene = await createPictureFindSceneFromUpload({
        groupId,
        title: title.trim() || '우리 가족 사진',
        diffMode,
        originalFile,
        variantFile,
        onProgress: setProgress,
      });
      onCreated(scene);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.upload_need_original);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h4 className="m-0 text-base font-bold text-slate-800">{t.upload_title}</h4>

      <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
        {t.upload_name_label}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.upload_name_ph}
          maxLength={80}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-indigo-400"
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setDiffMode('auto')}
          className={`rounded-xl border p-3 text-left ${
            diffMode === 'auto' ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'
          }`}
        >
          <p className="text-sm font-bold text-slate-800">{t.upload_diff_auto}</p>
          <p className="mt-1 text-xs text-slate-500">{t.upload_diff_auto_desc}</p>
        </button>
        <button
          type="button"
          onClick={() => setDiffMode('manual')}
          className={`rounded-xl border p-3 text-left ${
            diffMode === 'manual' ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'
          }`}
        >
          <p className="text-sm font-bold text-slate-800">{t.upload_diff_manual}</p>
          <p className="mt-1 text-xs text-slate-500">{t.upload_diff_manual_desc}</p>
        </button>
      </div>

      <FilePickBlock
        label={t.upload_original}
        previewUrl={originalPreview}
        fileName={originalFile?.name}
        pickLabel={t.upload_pick}
        cameraLabel={t.upload_camera}
        onGallery={() => {
          pickTarget.current = 'original';
          galleryRef.current?.click();
        }}
        onCamera={() => {
          pickTarget.current = 'original';
          cameraRef.current?.click();
        }}
      />

      {diffMode === 'manual' && (
        <FilePickBlock
          label={t.upload_variant}
          previewUrl={variantPreview}
          fileName={variantFile?.name}
          pickLabel={t.upload_pick}
          cameraLabel={t.upload_camera}
          onGallery={() => variantRef.current?.click()}
          onCamera={() => {
            pickTarget.current = 'variant';
            cameraRef.current?.click();
          }}
        />
      )}

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          assignFile(file, pickTarget.current);
          e.target.value = '';
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          assignFile(file, pickTarget.current);
          e.target.value = '';
        }}
      />
      <input
        ref={variantRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          assignFile(file, 'variant');
          e.target.value = '';
        }}
      />

      {uploading && (
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => void handleSubmit()}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {uploading ? t.upload_uploading : t.upload_submit}
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={onCancel}
          className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          {t.back}
        </button>
      </div>
    </div>
  );
}

function FilePickBlock({
  label,
  previewUrl,
  fileName,
  pickLabel,
  cameraLabel,
  onGallery,
  onCamera,
}: {
  label: string;
  previewUrl: string | null;
  fileName?: string;
  pickLabel: string;
  cameraLabel: string;
  onGallery: () => void;
  onCamera: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      {previewUrl ? (
        <div className="overflow-hidden rounded-lg bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={fileName || label} className="max-h-40 w-full object-contain" />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onGallery}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          {pickLabel}
        </button>
        <button
          type="button"
          onClick={onCamera}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          {cameraLabel}
        </button>
      </div>
    </div>
  );
}
