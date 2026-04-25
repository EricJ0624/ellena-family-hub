'use client';

import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { ChatMessageRow, ChatUiMessage } from '@/lib/chat-messages';
import { CHAT_PAGE_SIZE, formatFamilyMessagesFromRows, trimMessagesToMax } from '@/lib/chat-messages';
import {
  getAttachmentsForEntity,
  listAttachments,
  uploadFeatureAttachments,
  validateAttachmentFile,
  type UploadedAttachment,
} from '@/lib/feature-attachments-client';
import { familyChatDebug } from '@/lib/family-chat-debug';

type PermissionCache = { key: string; expiresAt: number } | null;

interface UseFamilyChatActionsParams {
  supabase: any;
  currentGroupId: string | null;
  userId: string;
  masterKey: string;
  messages: ChatUiMessage[];
  messagesRef: MutableRefObject<ChatUiMessage[]>;
  chatBoxRef: RefObject<HTMLDivElement | null>;
  chatScrollRestoreRef: MutableRefObject<{ sh: number; st: number } | null>;
  chatLoadingOlder: boolean;
  chatHasMoreOlder: boolean;
  chatPhotoUploadingRef: MutableRefObject<boolean>;
  chatTextSendingRef: MutableRefObject<boolean>;
  chatPostPermissionCacheRef: MutableRefObject<PermissionCache>;
  chatPostPermissionTtlMs: number;
  chatAttachmentsLoadGenRef: MutableRefObject<number>;
  loadChatAttachmentsRef: MutableRefObject<() => Promise<void>>;
  processedMessageIdsRef: MutableRefObject<Set<string>>;
  setChatAttachmentsByMessage: React.Dispatch<React.SetStateAction<Record<string, UploadedAttachment[]>>>;
  setChatHasMoreOlder: React.Dispatch<React.SetStateAction<boolean>>;
  setChatLoadingOlder: React.Dispatch<React.SetStateAction<boolean>>;
  setChatOutgoingPreviews: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  setChatTextSendingUi: React.Dispatch<React.SetStateAction<boolean>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatUiMessage[]>>;
  dt: (key: string) => string;
  refreshGroups: (() => Promise<void>) | null;
  getAuthKey: (uid: string) => string;
  sanitizeInput: (input: string | null | undefined, maxLength?: number) => string;
  encrypt: (data: any, key: string) => string;
}

export function useFamilyChatActions({
  supabase,
  currentGroupId,
  userId,
  masterKey,
  messages,
  messagesRef,
  chatBoxRef,
  chatScrollRestoreRef,
  chatLoadingOlder,
  chatHasMoreOlder,
  chatPhotoUploadingRef,
  chatTextSendingRef,
  chatPostPermissionCacheRef,
  chatPostPermissionTtlMs,
  chatAttachmentsLoadGenRef,
  loadChatAttachmentsRef,
  processedMessageIdsRef,
  setChatAttachmentsByMessage,
  setChatHasMoreOlder,
  setChatLoadingOlder,
  setChatOutgoingPreviews,
  setChatTextSendingUi,
  setMessages,
  dt,
  refreshGroups,
  getAuthKey,
  sanitizeInput,
  encrypt,
}: UseFamilyChatActionsParams) {
  const sessionCacheRef = useRef<{ expiresAt: number; session: any | null }>({
    expiresAt: 0,
    session: null,
  });
  const sessionInFlightRef = useRef<Promise<any | null> | null>(null);

  const getSessionForChat = useCallback(async () => {
    const now = Date.now();
    const cached = sessionCacheRef.current;
    if (cached.session && now < cached.expiresAt) {
      familyChatDebug('chat session cache hit');
      return cached.session;
    }

    if (sessionInFlightRef.current) {
      familyChatDebug('chat session in-flight reuse');
      return sessionInFlightRef.current;
    }

    const req = (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      // 아주 짧은 TTL로 연속 전송/업로드 시 중복 /user 호출 완화
      sessionCacheRef.current = {
        session: session ?? null,
        expiresAt: Date.now() + 1500,
      };
      return session ?? null;
    })();

    sessionInFlightRef.current = req;
    try {
      return await req;
    } finally {
      sessionInFlightRef.current = null;
    }
  }, [supabase]);

  const assertCanPostToFamilyChatGroup = useCallback(
    async (groupId: string, uid: string) => {
      const cacheKey = `${groupId}:${uid}`;
      const now = Date.now();
      const hit = chatPostPermissionCacheRef.current;
      if (hit && hit.key === cacheKey && now < hit.expiresAt) {
        return;
      }

      const markOk = () => {
        chatPostPermissionCacheRef.current = {
          key: cacheKey,
          expiresAt: Date.now() + chatPostPermissionTtlMs,
        };
      };

      const { data: mem, error: memErr } = await supabase
        .from('memberships')
        .select('group_id')
        .eq('user_id', uid)
        .eq('group_id', groupId)
        .maybeSingle();
      if (mem) {
        markOk();
        return;
      }
      if (memErr) {
        console.error('채팅 권한 확인 실패(memberships):', memErr);
        throw new Error('CHAT_PERMISSION_CHECK_MEMBERSHIPS_FAILED');
      }

      const { data: own, error: ownErr } = await supabase
        .from('groups')
        .select('id')
        .eq('id', groupId)
        .eq('owner_id', uid)
        .maybeSingle();
      if (own) {
        markOk();
        return;
      }
      if (ownErr) {
        console.error('채팅 권한 확인 실패(groups owner):', ownErr);
        throw new Error('CHAT_PERMISSION_CHECK_GROUP_OWNER_FAILED');
      }

      // 비멤버 시스템 관리자는 승인된 접근 요청이 있을 때 그룹 관리자 수준으로 허용
      const { data: isSystemAdminResult, error: sysErr } = await supabase.rpc('is_system_admin', {
        user_id_param: uid,
      });
      if (sysErr) {
        console.error('채팅 권한 확인 실패(is_system_admin):', sysErr);
        throw new Error('CHAT_PERMISSION_CHECK_SYSTEM_ADMIN_FAILED');
      }
      const isSystemAdmin = isSystemAdminResult === true;

      if (isSystemAdmin) {
        const nowIso = new Date().toISOString();
        const { data: approvedAccess, error: accessErr } = await supabase
          .from('dashboard_access_requests')
          .select('id')
          .eq('group_id', groupId)
          .eq('requested_by', uid)
          .eq('status', 'approved')
          .is('revoked_at', null)
          .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
          .limit(1)
          .maybeSingle();
        if (accessErr) {
          console.error('채팅 권한 확인 실패(dashboard_access_requests):', accessErr);
          throw new Error('CHAT_PERMISSION_CHECK_DASHBOARD_ACCESS_FAILED');
        }
        if (approvedAccess) {
          markOk();
          return;
        }
      }

      throw new Error('NO_FAMILY_GROUP_ACCESS');
    },
    [chatPostPermissionCacheRef, chatPostPermissionTtlMs, supabase]
  );

  const loadChatAttachments = useCallback(async () => {
    if (!currentGroupId) return;
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ids = (messages || [])
      .map((m) => String(m.id))
      .filter((id) => uuidLike.test(id));
    if (ids.length === 0) {
      chatAttachmentsLoadGenRef.current += 1;
      setChatAttachmentsByMessage({});
      return;
    }

    chatAttachmentsLoadGenRef.current += 1;
    const gen = chatAttachmentsLoadGenRef.current;
    try {
      const rows = await listAttachments({
        groupId: currentGroupId,
        entityType: 'chat_message',
        entityIds: ids,
      });
      if (gen !== chatAttachmentsLoadGenRef.current) return;

      const grouped: Record<string, UploadedAttachment[]> = {};
      for (const row of rows) {
        const key = String(row.entity_id);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row);
      }
      setChatAttachmentsByMessage(grouped);
    } catch (e) {
      console.error('[FamilyChat] 첨부 조회 오류:', e);
    }
  }, [chatAttachmentsLoadGenRef, currentGroupId, messages, setChatAttachmentsByMessage]);

  useEffect(() => {
    loadChatAttachmentsRef.current = loadChatAttachments;
  }, [loadChatAttachments, loadChatAttachmentsRef]);

  useEffect(() => {
    loadChatAttachments();
  }, [loadChatAttachments]);

  const loadOlderChatMessages = useCallback(async () => {
    if (!currentGroupId || !userId || chatLoadingOlder || !chatHasMoreOlder) return;
    const first = messagesRef.current[0];
    if (!first?.created_at) {
      setChatHasMoreOlder(false);
      return;
    }

    const el = chatBoxRef.current;
    if (el) {
      chatScrollRestoreRef.current = { sh: el.scrollHeight, st: el.scrollTop };
    }
    setChatLoadingOlder(true);
    try {
      const authKey = getAuthKey(userId);
      const currentKey =
        masterKey ||
        sessionStorage.getItem(authKey) ||
        process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY ||
        'ellena_family_shared_key_2024';
      const { data: raw, error } = await supabase
        .from('family_messages')
        .select('*')
        .eq('group_id', currentGroupId)
        .lt('created_at', first.created_at)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(CHAT_PAGE_SIZE);
      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('이전 채팅 로드 실패:', error);
        }
        chatScrollRestoreRef.current = null;
        return;
      }
      const batch = raw && raw.length > 0 ? [...raw].reverse() : [];
      const formatted = formatFamilyMessagesFromRows(batch as ChatMessageRow[], currentKey);
      const existing = new Set(messagesRef.current.map((m) => String(m.id)));
      const uniqueOlder = formatted.filter((m) => !existing.has(String(m.id)));
      setChatHasMoreOlder((raw?.length ?? 0) >= CHAT_PAGE_SIZE);
      if (uniqueOlder.length === 0) {
        setChatHasMoreOlder(false);
        chatScrollRestoreRef.current = null;
        return;
      }
      setMessages((prev) => trimMessagesToMax([...uniqueOlder, ...prev]));
    } finally {
      setChatLoadingOlder(false);
    }
  }, [
    chatBoxRef,
    chatHasMoreOlder,
    chatLoadingOlder,
    chatScrollRestoreRef,
    currentGroupId,
    getAuthKey,
    masterKey,
    messagesRef,
    setChatHasMoreOlder,
    setChatLoadingOlder,
    setMessages,
    supabase,
    userId,
  ]);

  const uploadChatPhotos = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      if (chatPhotoUploadingRef.current) {
        familyChatDebug('이미 사진 업로드 중, 중복 호출 무시');
        return;
      }
      if (files.length > 4) {
        alert('채팅 첨부는 최대 4장까지 가능합니다.');
        return;
      }
      for (const file of files) {
        const error = validateAttachmentFile(file);
        if (error) {
          alert(error);
          return;
        }
      }
      if (!currentGroupId) return;

      chatPhotoUploadingRef.current = true;
      familyChatDebug('사진 업로드 시작');

      const revokeOutgoingPreviews = (mid: string) => {
        setChatOutgoingPreviews((prev) => {
          const next = { ...prev };
          const urls = next[mid];
          if (urls) urls.forEach((u) => URL.revokeObjectURL(u));
          delete next[mid];
          return next;
        });
      };

      let outgoingPreviewMessageId: string | null = null;
      try {
        const session = await getSessionForChat();
        if (!session) {
          alert(dt('auth_session_expired'));
          return;
        }
        const authUid = session.user.id;
        await assertCanPostToFamilyChatGroup(currentGroupId, authUid);
        const currentKey =
          masterKey ||
          sessionStorage.getItem(getAuthKey(authUid)) ||
          process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY ||
          'ellena_family_shared_key_2024';

        const encryptedText = encrypt('', currentKey);
        const { data: inserted, error } = await supabase
          .from('family_messages')
          .insert({
            group_id: currentGroupId,
            sender_id: authUid,
            message_text: encryptedText,
          })
          .select('id')
          .single();
        if (error || !inserted?.id) throw new Error(error?.message || '메시지 저장 실패');

        const mid = String(inserted.id);
        outgoingPreviewMessageId = mid;
        const now = new Date();
        const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

        processedMessageIdsRef.current.add(mid);
        setMessages((prev) =>
          trimMessagesToMax([
            ...prev,
            {
              id: inserted.id,
              user: '나',
              text: '',
              time: timeStr,
              sender_id: authUid,
              created_at: now.toISOString(),
            },
          ])
        );
        familyChatDebug('사진 메시지 행 생성', inserted.id);

        const previewUrls = files.map((f) => URL.createObjectURL(f));
        setChatOutgoingPreviews((prev) => ({ ...prev, [mid]: previewUrls }));

        const jobs = await uploadFeatureAttachments({
          groupId: currentGroupId,
          featureType: 'chat',
          entityType: 'chat_message',
          entityId: mid,
          files,
          maxConcurrent: 3,
          retryCount: 1,
        });
        const failed = jobs.filter((j) => j.status === 'failed');
        if (failed.length > 0) {
          throw new Error(`사진 ${failed.length}장 업로드 실패`);
        }

        const attachments = await getAttachmentsForEntity({
          groupId: currentGroupId,
          entityType: 'chat_message',
          entityId: mid,
        });
        setChatAttachmentsByMessage((prev) => ({
          ...prev,
          [mid]: attachments,
        }));
        revokeOutgoingPreviews(mid);
        outgoingPreviewMessageId = null;
        void loadChatAttachmentsRef.current();
        familyChatDebug(`사진 ${attachments.length}개 업로드 완료`, inserted.id);
      } catch (error) {
        console.error('[FamilyChat] 사진 전송 오류:', error);
        if (outgoingPreviewMessageId) {
          revokeOutgoingPreviews(outgoingPreviewMessageId);
          outgoingPreviewMessageId = null;
        }
        const msg = error instanceof Error ? error.message : '';
        if (msg === 'NO_FAMILY_GROUP_ACCESS' || msg.toLowerCase().includes('row-level security')) {
          alert(dt('chat_send_no_access'));
          void refreshGroups?.();
        } else if (msg.startsWith('CHAT_PERMISSION_CHECK_')) {
          alert(`채팅 권한 확인 실패: ${msg}\n콘솔 로그를 확인해 원인을 점검해 주세요.`);
        } else {
          alert(error instanceof Error ? error.message : '사진 전송에 실패했습니다.');
        }
      } finally {
        chatPhotoUploadingRef.current = false;
        familyChatDebug('사진 업로드 완료, 플래그 해제');
      }
    },
    [
      assertCanPostToFamilyChatGroup,
      chatPhotoUploadingRef,
      currentGroupId,
      dt,
      encrypt,
      getSessionForChat,
      getAuthKey,
      loadChatAttachmentsRef,
      masterKey,
      processedMessageIdsRef,
      refreshGroups,
      setChatAttachmentsByMessage,
      setChatOutgoingPreviews,
      setMessages,
      supabase,
    ]
  );

  const handlePickChatFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      familyChatDebug('handlePickChatFiles', files.length, files.map((f) => f.name));
      await uploadChatPhotos(files);
      if (e.target) e.target.value = '';
    },
    [uploadChatPhotos]
  );

  const handleDropChatFiles = useCallback(
    async (files: File[]) => {
      await uploadChatPhotos(files);
    },
    [uploadChatPhotos]
  );

  const sendChat = useCallback(
    (messageFromChild?: string) => {
      const rawText = (messageFromChild ?? '').trim();
      const sanitizedText = sanitizeInput(rawText, 500);
      if (!sanitizedText) {
        familyChatDebug('sendChat: sanitize 후 빈 문자열', { rawLen: rawText.length });
        return;
      }

      familyChatDebug('sendChat 시작', { textLen: sanitizedText.length, groupId: currentGroupId ?? null });
      if (chatTextSendingRef.current) {
        familyChatDebug('이미 메시지 전송 중, 중복 호출 무시');
        return;
      }
      chatTextSendingRef.current = true;
      setChatTextSendingUi(true);
      familyChatDebug('텍스트 전송 잠금');
      // 네트워크/요청 정체로 finally가 늦어지는 경우 UI 잠금이 풀리지 않는 현상 방지
      const lockWatchdog = setTimeout(() => {
        if (!chatTextSendingRef.current) return;
        console.error('[FamilyChat] 텍스트 전송 잠금 watchdog 타임아웃');
        chatTextSendingRef.current = false;
        setChatTextSendingUi(false);
      }, 12000);

      const now = new Date();
      const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

      void (async () => {
        const startedAt = Date.now();
        try {
          if (!currentGroupId) {
            alert(dt('chat_send_no_group'));
            return;
          }
          const sessionStartedAt = Date.now();
          const session = await getSessionForChat();
          familyChatDebug('sendChat 단계: session', { elapsedMs: Date.now() - sessionStartedAt });
          if (!session) {
            alert(dt('auth_session_expired'));
            return;
          }
          const authUid = session.user.id;
          const permissionStartedAt = Date.now();
          await assertCanPostToFamilyChatGroup(currentGroupId, authUid);
          familyChatDebug('sendChat 단계: permission', { elapsedMs: Date.now() - permissionStartedAt });
          const currentKey =
            masterKey ||
            sessionStorage.getItem(getAuthKey(authUid)) ||
            process.env.NEXT_PUBLIC_FAMILY_SHARED_KEY ||
            'ellena_family_shared_key_2024';

          const encryptedText = encrypt(sanitizedText, currentKey);
          const insertStartedAt = Date.now();
          const { data: inserted, error } = await supabase
            .from('family_messages')
            .insert({
              group_id: currentGroupId,
              sender_id: authUid,
              message_text: encryptedText,
            })
            .select('id')
            .single();
          familyChatDebug('sendChat 단계: insert', { elapsedMs: Date.now() - insertStartedAt });
          if (error || !inserted?.id) throw new Error(error?.message || '메시지 저장 실패');

          processedMessageIdsRef.current.add(String(inserted.id));
          setMessages((prev) =>
            trimMessagesToMax([
              ...prev,
              {
                id: inserted.id,
                user: '나',
                text: sanitizedText,
                time: timeStr,
                sender_id: authUid,
                created_at: new Date().toISOString(),
              },
            ])
          );
          familyChatDebug('텍스트 메시지 전송 완료', inserted.id);
          familyChatDebug('sendChat 총 소요', { elapsedMs: Date.now() - startedAt });
        } catch (e) {
          console.error('[FamilyChat] 메시지 전송 오류:', e);
          const msg = e instanceof Error ? e.message : '';
          if (msg === 'NO_FAMILY_GROUP_ACCESS' || msg.toLowerCase().includes('row-level security')) {
            alert(dt('chat_send_no_access'));
            void refreshGroups?.();
          } else if (msg.startsWith('CHAT_PERMISSION_CHECK_')) {
            alert(`채팅 권한 확인 실패: ${msg}\n콘솔 로그를 확인해 원인을 점검해 주세요.`);
          } else {
            alert(e instanceof Error ? e.message : '메시지 전송에 실패했습니다.');
          }
        } finally {
          clearTimeout(lockWatchdog);
          chatTextSendingRef.current = false;
          setChatTextSendingUi(false);
          familyChatDebug('텍스트 전송 완료, 플래그 해제');
        }
      })();
    },
    [
      assertCanPostToFamilyChatGroup,
      chatTextSendingRef,
      currentGroupId,
      dt,
      encrypt,
      getSessionForChat,
      getAuthKey,
      masterKey,
      processedMessageIdsRef,
      refreshGroups,
      sanitizeInput,
      setChatTextSendingUi,
      setMessages,
      supabase,
    ]
  );

  return {
    assertCanPostToFamilyChatGroup,
    loadChatAttachments,
    loadOlderChatMessages,
    handlePickChatFiles,
    handleDropChatFiles,
    sendChat,
  };
}
