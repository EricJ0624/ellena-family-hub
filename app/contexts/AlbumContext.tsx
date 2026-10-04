'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import CryptoJS from 'crypto-js';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import { DB_TABLES } from '@/lib/db-table-names';
import { getStorageKey, getAuthKey, CryptoService } from '@/lib/dashboard-storage';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import { clearViewedAlbumPhotoUrls } from '@/lib/album-viewed-photo-urls';
import { clampLocationOvalFocusY, parseAlbumFocusY } from '@/lib/album-photo-focus';

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
  taken_at?: string | null; // 촬영일시 ISO. null이면 날짜 없음
  upload_mode?: 'normal' | 'original' | null; // 다운로드 라벨용
  /** 세로 크롭 object-position y %. null/undefined = 미저장 */
  focus_y?: number | null;
};

type AlbumContextType = {
  album: Photo[];
  albumRef: React.MutableRefObject<Photo[]>;
  addPhoto: (payload: Photo) => void;
  deletePhoto: (id: number | string) => void;
  updatePhotoDescription: (payload: { photoId: number | string; description: string }) => void;
  updatePhotoFocusY: (payload: { photoId: number | string; focusY: number }) => Promise<boolean>;
  updatePhotoId: (payload: {
    oldId: number | string;
    newId: number | string;
    s3Url?: string | null;
    uploadFailed?: boolean;
  }) => void;
};

const AlbumContext = createContext<AlbumContextType | undefined>(undefined);

function albumSignature(photos: readonly Photo[]): string {
  if (!photos.length) return '';
  return photos
    .map((p) => `${p.id}:${p.data}:${p.focus_y ?? ''}:${p.description ?? ''}`)
    .join('|');
}

function sameAlbum(a: readonly Photo[], b: readonly Photo[]): boolean {
  return albumSignature(a) === albumSignature(b);
}

/** 세션 없이 같은 그룹의 안정 URL만 읽는다. 조회 실패 복구와 선표시가 같은 필터를 쓴다. */
function readStableLocalAlbum(userId: string, groupId: string): Photo[] {
  try {
    const key =
      sessionStorage.getItem(getAuthKey(userId)) ||
      process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY ||
      'ellena_family_shared_key_2024';
    const saved = localStorage.getItem(getStorageKey(userId, groupId));
    if (!saved) return [];
    const decrypted = CryptoService.decrypt(saved, key) as { album?: Photo[] } | null;
    if (!decrypted?.album || !Array.isArray(decrypted.album)) return [];
    return decrypted.album.filter(
      (p) =>
        !!p?.data &&
        (p.data.startsWith('http://') ||
          p.data.startsWith('https://') ||
          p.data.startsWith('/api/photo/proxy')),
    );
  } catch {
    return [];
  }
}

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
    // blob/data URL은 저장하지 않음 → 뒤로가기 후 재진입 시 Hydration 에러 방지
    // 일반 업로드 프록시 경로 포함 (대시보드/액자와 동일하게 stable로 취급)
    const stableOnly = newAlbum.filter(
      (p) =>
        p.data &&
        (p.data.startsWith('http://') ||
          p.data.startsWith('https://') ||
          p.data.startsWith('/api/photo/proxy'))
    );
    const withoutOriginal = stableOnly.map((p) => {
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
  const realtimeResyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** loadAlbum 비동기 완료 시점에 그룹이 바뀌었으면 setAlbum 하지 않음 */
  const albumCurrentGroupIdRef = useRef<string | null>(null);
  /** 화면에 올려 둔 앨범의 그룹. 같은 그룹 재조회는 캐시로 덮지 않는다. */
  const shownAlbumGroupRef = useRef<string | null>(null);
  albumCurrentGroupIdRef.current = currentGroupId;

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
      clearViewedAlbumPhotoUrls();
      shownAlbumGroupRef.current = null;
      setAlbum([]);
      return;
    }

    const groupIdForThisLoad = currentGroupId;
    const isStale = () => groupIdForThisLoad !== albumCurrentGroupIdRef.current;

    // 세션·서버보다 먼저 같은 그룹 URL을 그린다. 다른 그룹이면 그 캐시 또는 빈 목록으로 바로 갈아탄다.
    const cached = readStableLocalAlbum(userId, groupIdForThisLoad);
    const groupChanged = shownAlbumGroupRef.current !== groupIdForThisLoad;
    if (groupChanged) {
      shownAlbumGroupRef.current = groupIdForThisLoad;
      clearViewedAlbumPhotoUrls();
      setAlbum((prev) => (sameAlbum(prev, cached) ? prev : cached));
    } else if (cached.length > 0) {
      setAlbum((prev) => (prev.length > 0 ? prev : cached));
    }

    const session = await waitForSupabaseSession(supabase);
    if (!session?.access_token || isStale()) {
      if (!session?.access_token) {
        console.warn('[Album] session not ready, skip load');
      }
      return;
    }

    const localAlbum = cached;

    // 가입 직후·그룹 전환 직후 멤버십/세션 타이밍으로 첫 조회가 실패할 수 있어 짧게 재시도
    let photos: Record<string, unknown>[] | null = null;
    let error: { message?: string; code?: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (isStale()) return;

      const res = await supabase
        .from(DB_TABLES.FAMILY_ALBUM_ITEMS)
        .select(
          'id, image_url, s3_original_url, file_type, original_filename, mime_type, created_at, uploader_id, caption, group_id, taken_at, upload_mode, focus_y'
        )
        .eq('group_id', groupIdForThisLoad)
        .order('created_at', { ascending: false })
        .limit(100);
      error = res.error;
      photos = res.data as Record<string, unknown>[] | null;
      if (!res.error) break;
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Album] memory_vault load failed, retry', attempt + 1, res.error.message, res.error.code);
      }
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
      }
    }

    if (isStale()) return;

    if (error) {
      if (!isStale()) {
        setAlbum((prev) => (sameAlbum(prev, localAlbum) ? prev : localAlbum));
      }
      return;
    }

    const supabasePhotos: Photo[] = (photos || [])
      .filter((p: Record<string, unknown>) => p.image_url || p.s3_original_url)
      .map((p: Record<string, unknown>) => ({
        id: p.id as string | number,
        data: (p.image_url || p.s3_original_url) as string,
        supabaseId: p.id as string | number,
        isUploaded: true,
        isUploading: false,
        description: (p.caption as string) || '',
        originalFilename: (p.original_filename as string) || '',
        mimeType: (p.mime_type as string) || 'image/jpeg',
        created_by: (p.uploader_id || p.created_by) as string | undefined,
        taken_at: (p.taken_at as string | null) ?? null,
        upload_mode: (p.upload_mode as 'normal' | 'original' | null) ?? null,
        focus_y: parseAlbumFocusY(p.focus_y),
      }));

    const supabaseIds = new Set(supabasePhotos.map((p) => String(p.id)));
    // blob/data URL은 merge하지 않음 → 뒤로가기 후 대시보드 Hydration 에러 방지
    const localOnly = localAlbum.filter((p) => {
      const sid = p.supabaseId ? String(p.supabaseId) : null;
      if (sid && supabaseIds.has(sid)) return false;
      if (!p.data) return false;
      return (
        p.data.startsWith('http://') ||
        p.data.startsWith('https://') ||
        p.data.startsWith('/api/photo/proxy')
      );
    });
    const merged = [...supabasePhotos, ...localOnly];
    if (!isStale()) {
      setAlbum((prev) => (sameAlbum(prev, merged) ? prev : merged));
      if (!sameAlbum(localAlbum, merged)) {
        const key =
          sessionStorage.getItem(getAuthKey(userId)) ||
          process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY ||
          'ellena_family_shared_key_2024';
        persistAlbumOnly(userId, groupIdForThisLoad, key, merged);
      }
    }
  }, [userId, currentGroupId]);

  useEffect(() => {
    loadAlbum();
  }, [loadAlbum]);

  useEffect(() => {
    if (!userId || !currentGroupId) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.access_token) {
        void loadAlbum();
      }
    });
    return () => subscription.unsubscribe();
  }, [userId, currentGroupId, loadAlbum]);

  useEffect(() => {
    if (!currentGroupId || !userId) return;

    if (photosChannelRef.current) {
      supabase.removeChannel(photosChannelRef.current);
      photosChannelRef.current = null;
    }

    // 채널당 postgres_changes 1개만 사용 (여러 개 시 server/client bindings mismatch)
    const gid = String(currentGroupId);
    const ch = supabase
      .channel(`${DB_TABLES.FAMILY_ALBUM_ITEMS}_album:${currentGroupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: DB_TABLES.FAMILY_ALBUM_ITEMS,
          filter: `group_id=eq.${gid}`,
        },
        (payload: { eventType?: string; old?: { id?: unknown }; new?: Record<string, unknown> }) => {
        const ev = payload.eventType ?? (payload.old && !payload.new ? 'DELETE' : payload.new ? 'UPDATE' : 'INSERT');
        if (ev === 'DELETE') {
          const id = payload.old?.id;
          if (id == null) return;
          setAlbum((prev) =>
            prev.filter((p) => String(p.id) !== String(id) && (p.supabaseId ? String(p.supabaseId) !== String(id) : true))
          );
          return;
        }
        if (ev === 'UPDATE' && payload.new) {
          const updated = payload.new as Record<string, unknown>;
          const url = (updated.image_url || updated.s3_original_url) as string;
          if (!url) return;
          if (String(updated.group_id ?? '') !== gid) return;
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
                    taken_at: (updated.taken_at as string | null) ?? p.taken_at ?? null,
                    upload_mode: (updated.upload_mode as 'normal' | 'original' | null) ?? p.upload_mode ?? null,
                    focus_y:
                      updated.focus_y === null
                        ? null
                        : parseAlbumFocusY(updated.focus_y) ?? p.focus_y ?? null,
                  }
                : p
            )
          );
          return;
        }
        // INSERT
        const newPhoto = payload.new as Record<string, unknown> | undefined;
        if (!newPhoto || String(newPhoto.group_id ?? '') !== gid) return;
        const url = (newPhoto.image_url || newPhoto.s3_original_url) as string;
        if (!url) return;
        const newEntry: Photo = {
          id: newPhoto.id as string | number,
          data: url,
          supabaseId: newPhoto.id as string | number,
          isUploaded: true,
          isUploading: false,
          created_by: (newPhoto.uploader_id || newPhoto.created_by) as string | undefined,
          taken_at: (newPhoto.taken_at as string | null) ?? null,
          upload_mode: (newPhoto.upload_mode as 'normal' | 'original' | null) ?? null,
          focus_y: parseAlbumFocusY(newPhoto.focus_y),
        };
        setAlbum((prev) => {
          const exists = prev.some(
            (p) => String(p.id) === String(newPhoto.id) || (p.supabaseId && String(p.supabaseId) === String(newPhoto.id))
          );
          if (exists) return prev;
          const uploadingIndex = prev.findIndex((p) => p.isUploading && !p.supabaseId);
          if (uploadingIndex !== -1) {
            const next = [...prev];
            next[uploadingIndex] = newEntry;
            return next;
          }
          return [newEntry, ...prev];
        });
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[Album] memory_vault realtime:', status);
          }
          if (realtimeResyncTimerRef.current) {
            clearTimeout(realtimeResyncTimerRef.current);
          }
          realtimeResyncTimerRef.current = setTimeout(() => {
            realtimeResyncTimerRef.current = null;
            void loadAlbum();
          }, 800);
        }
      });
    photosChannelRef.current = ch;

    return () => {
      if (realtimeResyncTimerRef.current) {
        clearTimeout(realtimeResyncTimerRef.current);
        realtimeResyncTimerRef.current = null;
      }
      if (photosChannelRef.current) {
        supabase.removeChannel(photosChannelRef.current);
        photosChannelRef.current = null;
      }
    };
  }, [currentGroupId, userId, loadAlbum]);

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
            data: payload.s3Url || p.data,
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
              .from(DB_TABLES.FAMILY_ALBUM_ITEMS)
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

  const updatePhotoFocusY = useCallback(
    async (payload: { photoId: number | string; focusY: number }): Promise<boolean> => {
      if (!currentGroupId) return false;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return false;

      const focusY = clampLocationOvalFocusY(payload.focusY);
      try {
        const res = await fetch('/api/photos/focus-y', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            photoId: String(payload.photoId),
            groupId: currentGroupId,
            focusY,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          focusY?: number;
          error?: string;
        };
        if (!res.ok && res.status !== 409) {
          if (process.env.NODE_ENV === 'development') {
            console.error('focus_y update error', json.error || res.status);
          }
          return false;
        }
        const savedY =
          typeof json.focusY === 'number' && Number.isFinite(json.focusY) ? json.focusY : focusY;
        setAlbum((prev) => {
          const next = prev.map((p) => {
            const match =
              String(p.id) === String(payload.photoId) ||
              (p.supabaseId != null && String(p.supabaseId) === String(payload.photoId));
            return match ? { ...p, focus_y: savedY } : p;
          });
          albumRef.current = next;
          const key = getKey();
          if (key && userId) persistAlbumOnly(userId, currentGroupId, key, next);
          return next;
        });
        return true;
      } catch (err) {
        if (process.env.NODE_ENV === 'development') console.error('updatePhotoFocusY error', err);
        return false;
      }
    },
    [getKey, userId, currentGroupId]
  );

  const value: AlbumContextType = {
    album,
    albumRef,
    addPhoto,
    deletePhoto,
    updatePhotoDescription,
    updatePhotoFocusY,
    updatePhotoId,
  };

  return <AlbumContext.Provider value={value}>{children}</AlbumContext.Provider>;
}

export function useAlbum() {
  const ctx = useContext(AlbumContext);
  if (ctx === undefined) throw new Error('useAlbum must be used within AlbumProvider');
  return ctx;
}
