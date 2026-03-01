'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import CryptoJS from 'crypto-js';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import { getStorageKey, getAuthKey, CryptoService } from '@/lib/dashboard-storage';

export type Photo = {
  id: number | string;
  data: string;
  originalData?: string;
  originalSize?: number;
  originalFilename?: string;
  mimeType?: string;
  supabaseId?: string | number;
  isUploaded?: boolean;
  isUploading?: boolean;
  created_by?: string;
  description?: string;
};

type AlbumContextType = {
  album: Photo[];
  albumRef: React.MutableRefObject<Photo[]>;
  addPhoto: (payload: Photo) => void;
  deletePhoto: (id: number | string) => void;
  updatePhotoDescription: (payload: { photoId: number | string; description: string }) => void;
  updatePhotoId: (payload: {
    oldId: number | string;
    newId: number | string;
    cloudinaryUrl?: string | null;
    s3Url?: string | null;
    uploadFailed?: boolean;
  }) => void;
};

const AlbumContext = createContext<AlbumContextType | undefined>(undefined);

function persistAlbumOnly(
  userId: string,
  groupId: string | null,
  key: string,
  newAlbum: Photo[]
): void {
  if (!userId || !groupId) return;
  try {
    const storageKey = getStorageKey(userId, groupId);
    const saved = localStorage.getItem(storageKey);
    let state: Record<string, unknown> = {};
    if (saved) {
      const decrypted = CryptoService.decrypt(saved, key) as Record<string, unknown> | null;
      if (decrypted && typeof decrypted === 'object') state = { ...decrypted };
    }
    const withoutOriginal = newAlbum.map((p) => {
      const { originalData: _, ...rest } = p;
      return rest;
    });
    state.album = withoutOriginal;
    localStorage.setItem(storageKey, CryptoJS.AES.encrypt(JSON.stringify(state), key).toString());
  } catch (e) {
    if (process.env.NODE_ENV === 'development') console.warn('persistAlbumOnly error', e);
  }
}

export function AlbumProvider({ children }: { children: ReactNode }) {
  const { currentGroupId } = useGroup();
  const [userId, setUserId] = useState<string | null>(null);
  const [album, setAlbum] = useState<Photo[]>([]);
  const albumRef = useRef<Photo[]>([]);
  const photosChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    albumRef.current = album;
  }, [album]);

  useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    };
    getUserId();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadAlbum = useCallback(async () => {
    if (!userId || !currentGroupId) {
      setAlbum([]);
      return;
    }
    // 그룹 전환 시 이전 그룹 앨범 즉시 제거 (blob/잘못된 데이터 노출·Hydration 에러 방지)
    setAlbum([]);
    const key =
      sessionStorage.getItem(getAuthKey(userId)) ||
      process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY ||
      'ellena_family_shared_key_2024';
    const storageKey = getStorageKey(userId, currentGroupId);
    const saved = localStorage.getItem(storageKey);
    let localAlbum: Photo[] = [];
    if (saved) {
      const decrypted = CryptoService.decrypt(saved, key) as { album?: Photo[] } | null;
      if (decrypted?.album && Array.isArray(decrypted.album)) localAlbum = decrypted.album;
    }

    const { data: photos, error } = await supabase
      .from('memory_vault')
      .select('id, image_url, cloudinary_url, s3_original_url, file_type, original_filename, mime_type, created_at, uploader_id, caption, group_id')
      .eq('group_id', currentGroupId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      setAlbum(localAlbum);
      return;
    }

    const supabasePhotos: Photo[] = (photos || [])
      .filter((p: { image_url?: string; cloudinary_url?: string; s3_original_url?: string }) => p.image_url || p.cloudinary_url || p.s3_original_url)
      .map((p: Record<string, unknown>) => ({
        id: p.id as string | number,
        data: (p.image_url || p.cloudinary_url || p.s3_original_url) as string,
        supabaseId: p.id as string | number,
        isUploaded: true,
        isUploading: false,
        description: (p.caption as string) || '',
        originalFilename: (p.original_filename as string) || '',
        mimeType: (p.mime_type as string) || 'image/jpeg',
        created_by: (p.uploader_id || p.created_by) as string | undefined,
      }));

    const supabaseIds = new Set(supabasePhotos.map((p) => String(p.id)));
    const localOnly = localAlbum.filter((p) => {
      const sid = p.supabaseId ? String(p.supabaseId) : null;
      if (sid && supabaseIds.has(sid)) return false;
      return p.isUploading === true || (p.data && (p.data.startsWith('data:') || p.data.startsWith('blob:')));
    });
    const merged = [...supabasePhotos, ...localOnly];
    setAlbum(merged);
  }, [userId, currentGroupId]);

  useEffect(() => {
    loadAlbum();
  }, [loadAlbum]);

  useEffect(() => {
    if (!currentGroupId || !userId) return;

    if (photosChannelRef.current) {
      supabase.removeChannel(photosChannelRef.current);
      photosChannelRef.current = null;
    }

    const ch = supabase
      .channel('memory_vault_album')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'memory_vault' }, (payload: { new: Record<string, unknown> }) => {
        const newPhoto = payload.new;
        if (newPhoto.group_id !== currentGroupId) return;
        const url = (newPhoto.image_url || newPhoto.cloudinary_url || newPhoto.s3_original_url) as string;
        if (!url) return;
        const newEntry = {
          id: newPhoto.id as string | number,
          data: url,
          supabaseId: newPhoto.id as string | number,
          isUploaded: true,
          isUploading: false,
          created_by: (newPhoto.uploader_id || newPhoto.created_by) as string | undefined,
        };
        setAlbum((prev) => {
          const exists = prev.some(
            (p) => String(p.id) === String(newPhoto.id) || (p.supabaseId && String(p.supabaseId) === String(newPhoto.id))
          );
          if (exists) return prev;
          // 업로드 중인 낙관적 항목이 있으면 그 중 하나를 실제 행으로 교체 (중복 표시 방지)
          const uploadingIndex = prev.findIndex((p) => p.isUploading && !p.supabaseId);
          if (uploadingIndex !== -1) {
            const next = [...prev];
            next[uploadingIndex] = newEntry;
            return next;
          }
          return [newEntry, ...prev];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'memory_vault' }, (payload: { new: Record<string, unknown> }) => {
        const updated = payload.new;
        const url = (updated.image_url || updated.cloudinary_url || updated.s3_original_url) as string;
        if (!url) return;
        setAlbum((prev) =>
          prev.map((p) =>
            p.id === updated.id || p.supabaseId === updated.id
              ? {
                  ...p,
                  id: updated.id as string | number,
                  data: url,
                  supabaseId: updated.id as string | number,
                  isUploaded: true,
                  created_by: (updated.uploader_id || updated.created_by || p.created_by) as string | undefined,
                }
              : p
          )
        );
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'memory_vault' }, (payload: { old: { id?: unknown } }) => {
        const id = payload.old?.id;
        if (id == null) return;
        setAlbum((prev) =>
          prev.filter((p) => String(p.id) !== String(id) && (p.supabaseId ? String(p.supabaseId) !== String(id) : true))
        );
      })
      .subscribe();
    photosChannelRef.current = ch;

    return () => {
      if (photosChannelRef.current) {
        supabase.removeChannel(photosChannelRef.current);
        photosChannelRef.current = null;
      }
    };
  }, [currentGroupId, userId]);

  const getKey = useCallback(() => {
    if (!userId) return '';
    return (
      sessionStorage.getItem(getAuthKey(userId)) ||
      process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY ||
      'ellena_family_shared_key_2024'
    );
  }, [userId]);

  const addPhoto = useCallback(
    (payload: Photo) => {
      setAlbum((prev) => {
        const next = [payload, ...prev];
        albumRef.current = next;
        const key = getKey();
        if (key && userId) persistAlbumOnly(userId, currentGroupId, key, next);
        return next;
      });
    },
    [getKey, userId, currentGroupId]
  );

  const updatePhotoId = useCallback(
    (payload: {
      oldId: number | string;
      newId: number | string;
      cloudinaryUrl?: string | null;
      s3Url?: string | null;
      uploadFailed?: boolean;
    }) => {
      setAlbum((prev) => {
        const next = prev.map((p) => {
          if (p.id !== payload.oldId) return p;
          if (payload.uploadFailed) return { ...p, isUploading: false };
          return {
            ...p,
            id: payload.newId,
            data: payload.cloudinaryUrl || payload.s3Url || p.data,
            supabaseId: payload.newId,
            isUploaded: true,
            isUploading: false,
          };
        });
        albumRef.current = next;
        const key = getKey();
        if (key && userId) persistAlbumOnly(userId, currentGroupId, key, next);
        return next;
      });
    },
    [getKey, userId, currentGroupId]
  );

  const deletePhoto = useCallback(
    (id: number | string) => {
      setAlbum((prev) => {
        const next = prev.filter((p) => p.id !== id);
        albumRef.current = next;
        const key = getKey();
        if (key && userId) persistAlbumOnly(userId, currentGroupId, key, next);
        return next;
      });

      (async () => {
        if (!currentGroupId) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        try {
          await fetch('/api/photos/delete', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ photoId: id, groupId: currentGroupId }),
          });
        } catch (err) {
          if (process.env.NODE_ENV === 'development') console.error('deletePhoto API error', err);
        }
      })();
    },
    [getKey, userId, currentGroupId]
  );

  const updatePhotoDescription = useCallback(
    (payload: { photoId: number | string; description: string }) => {
      setAlbum((prev) => {
        const next = prev.map((p) => {
          if (p.id !== payload.photoId) return p;
          if (p.supabaseId) {
            supabase
              .from('memory_vault')
              .update({ caption: payload.description || null })
              .eq('id', p.supabaseId)
              .then(({ error }) => {
                if (error && process.env.NODE_ENV === 'development') console.error('caption update error', error);
              });
          }
          return { ...p, description: payload.description };
        });
        albumRef.current = next;
        const key = getKey();
        if (key && userId) persistAlbumOnly(userId, currentGroupId, key, next);
        return next;
      });
    },
    [getKey, userId, currentGroupId]
  );

  const value: AlbumContextType = {
    album,
    albumRef,
    addPhoto,
    deletePhoto,
    updatePhotoDescription,
    updatePhotoId,
  };

  return <AlbumContext.Provider value={value}>{children}</AlbumContext.Provider>;
}

export function useAlbum() {
  const ctx = useContext(AlbumContext);
  if (ctx === undefined) throw new Error('useAlbum must be used within AlbumProvider');
  return ctx;
}
