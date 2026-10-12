'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { isOpaqueIdLabel, profileNicknameLabel } from '@/app/features/family-games/components/MemberSelect';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import { getCommonTranslation } from '@/lib/translations/common';
import { getFamilyRoleEmoji, getFamilyRoleLabel } from '@/lib/translations/memberManagement';
import type { LangCode } from '@/lib/language-fonts';

export type DashboardOnlineUser = { id: string; name: string; isCurrentUser: boolean };

function onlineUsersSignature(
  users: ReadonlyArray<{ id: string; name: string; isCurrentUser: boolean }>,
): string {
  if (!users.length) return '';
  return users.map((u) => `${u.id}:${u.name}:${u.isCurrentUser ? 1 : 0}`).join('|');
}

let latestOnlineUsers: DashboardOnlineUser[] = [];

/** page.tsx loadFamilyLocations 폴백 — 구독 없이 최신 Presence 표시명만 읽음 */
export function getOnlineUsersSnapshot(): DashboardOnlineUser[] {
  return latestOnlineUsers;
}

type DashboardPresenceChannel = {
  state?: string;
  unsubscribe?: () => void;
  track?: (payload: Record<string, unknown>) => Promise<unknown>;
  presenceState?: () => Record<string, unknown>;
};

let presenceChannel: DashboardPresenceChannel | null = null;

export async function teardownDashboardPresence() {
  const ch = presenceChannel;
  presenceChannel = null;
  if (ch) {
    try {
      await supabase.removeChannel(ch as Parameters<typeof supabase.removeChannel>[0]);
    } catch {
      // 이미 제거된 채널
    }
  }
}

const OnlineUsersContext = createContext<DashboardOnlineUser[] | null>(null);

export function useOnlineUsers(): DashboardOnlineUser[] {
  return useContext(OnlineUsersContext) ?? [];
}

export function OnlinePresenceProvider({
  isAuthenticated,
  userId,
  currentGroupId,
  userName,
  children,
}: {
  isAuthenticated: boolean;
  userId: string;
  currentGroupId: string | null;
  userName: string;
  children: React.ReactNode;
}) {
  const [onlineUsers, setOnlineUsers] = useState<DashboardOnlineUser[]>([]);
  const userIdRef = useRef(userId);
  const groupIdRef = useRef(currentGroupId);
  const userNameRef = useRef(userName);
  const lastTrackedNameRef = useRef('');
  userIdRef.current = userId;
  groupIdRef.current = currentGroupId;
  userNameRef.current = userName;

  useEffect(() => {
    latestOnlineUsers = onlineUsers;
  }, [onlineUsers]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!isAuthenticated || !userId || !currentGroupId) {
      setOnlineUsers([]);
      void teardownDashboardPresence();
      return;
    }

    const setupPresenceSubscription = () => {
      if (typeof window === 'undefined') return;
      if (!currentGroupId) {
        setOnlineUsers([]);
        return;
      }

      let presenceBuildGen = 0;

      const applyOnlineUsers = (usersList: DashboardOnlineUser[]) => {
        setOnlineUsers((prev) => {
          const prevById = new Map(prev.map((user) => [user.id, user.name]));
          const merged = usersList.map((user) => {
            if (user.name.trim()) return user;
            const previous = prevById.get(user.id)?.trim() ?? '';
            if (previous && !isOpaqueIdLabel(previous, user.id)) {
              return { ...user, name: previous };
            }
            return { ...user, name: '' };
          });
          return onlineUsersSignature(prev) === onlineUsersSignature(merged) ? prev : merged;
        });
      };

      const buildOnlineUsersListFromPresence = async (
        presenceState: Record<string, unknown>
      ): Promise<{ users: DashboardOnlineUser[]; retry: boolean }> => {
        const me = userIdRef.current;
        const gid = groupIdRef.current;
        const usersList: DashboardOnlineUser[] = [];
        if (me) {
          usersList.push({
            id: me,
            name: userNameRef.current?.trim() || '',
            isCurrentUser: true,
          });
        }
        const sameGroup = (p: { groupId?: string }) =>
          gid != null &&
          p.groupId != null &&
          String(p.groupId) === String(gid);
        const presNameById = new Map<string, string>();
        for (const presenceId of Object.keys(presenceState)) {
          const presence = presenceState[presenceId];
          if (Array.isArray(presence) && presence.length > 0) {
            const userPresence = presence[0] as { userId?: string; groupId?: string; userName?: string };
            const uid = userPresence.userId;
            if (uid && String(uid) !== String(me) && sameGroup(userPresence)) {
              const presName = userPresence.userName != null ? String(userPresence.userName).trim() : '';
              presNameById.set(uid, presName && !isOpaqueIdLabel(presName, uid) ? presName : '');
            }
          }
        }
        const otherIds = [...presNameById.keys()];
        const profilesMap = new Map<string, { nickname?: string | null; display_name?: string | null; email?: string | null }>();
        let retry = false;
        if (otherIds.length > 0) {
          await waitForSupabaseSession(supabase);
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, nickname, display_name, email')
            .in('id', otherIds);
          if (profilesError || !profilesData) {
            retry = true;
          } else {
            profilesData.forEach((p: { id: string; nickname?: string | null; display_name?: string | null; email?: string | null }) => {
              profilesMap.set(String(p.id).toLowerCase(), p);
            });
            retry = otherIds.some((id) => !profilesMap.has(String(id).toLowerCase()));
          }
        }
        const othersById = new Map<string, DashboardOnlineUser>();
        for (const [uid, presName] of presNameById) {
          const profile = profilesMap.get(String(uid).toLowerCase());
          const displayName = profileNicknameLabel(profile, uid) || presName;
          othersById.set(uid, { id: uid, name: displayName, isCurrentUser: false });
        }
        usersList.push(...othersById.values());
        return { users: usersList, retry };
      };

      const publishPresenceNames = (presenceState: Record<string, unknown>) => {
        const gen = ++presenceBuildGen;
        setTimeout(() => {
          void (async () => {
            if (gen !== presenceBuildGen) return;
            const built = await buildOnlineUsersListFromPresence(presenceState);
            if (gen !== presenceBuildGen) return;
            applyOnlineUsers(built.users);
            if (!built.retry) return;
            setTimeout(() => {
              void (async () => {
                if (gen !== presenceBuildGen) return;
                const again = await buildOnlineUsersListFromPresence(presenceState);
                if (gen !== presenceBuildGen) return;
                applyOnlineUsers(again.users);
              })();
            }, 1200);
          })();
        }, 0);
      };

      const presenceTopic = `online_users:${currentGroupId}`;
      const isPresenceTopic = (ch: { topic?: string }) => {
        const topic = ch.topic ?? '';
        return topic === presenceTopic || topic === `realtime:${presenceTopic}`;
      };
      const leftoverPresence = supabase.getChannels().filter(isPresenceTopic);
      const reusablePresence = leftoverPresence.find((ch) => ch.state === 'joined' || ch.state === 'joining');
      if (reusablePresence) {
        presenceChannel = reusablePresence;
        publishPresenceNames(reusablePresence.presenceState());
        return;
      }

      const bindPresenceChannel = () => {
        const alreadyBound = supabase.getChannels().find(
          (ch) => isPresenceTopic(ch) && (ch.state === 'joined' || ch.state === 'joining'),
        );
        if (alreadyBound) {
          presenceChannel = alreadyBound;
          publishPresenceNames(alreadyBound.presenceState());
          return;
        }
        const presenceSubscription = supabase
          .channel(presenceTopic)
          .on('presence', { event: 'sync' }, () => {
            publishPresenceNames(presenceSubscription.presenceState());
          })
          .on('presence', { event: 'join' }, () => {
            publishPresenceNames(presenceSubscription.presenceState());
          })
          .on('presence', { event: 'leave' }, () => {
            publishPresenceNames(presenceSubscription.presenceState());
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              presenceChannel = presenceSubscription;
              const name = userNameRef.current?.trim() || '';
              lastTrackedNameRef.current = name;
              await presenceSubscription.track({
                userId: userIdRef.current,
                userName: name,
                groupId: groupIdRef.current,
                onlineAt: new Date().toISOString(),
              });
            }
          });
        presenceChannel = presenceSubscription;
      };

      if (leftoverPresence.length > 0) {
        void Promise.all(leftoverPresence.map((ch) => supabase.removeChannel(ch))).finally(() => {
          const again = supabase.getChannels().filter(isPresenceTopic);
          const joined = again.find((ch) => ch.state === 'joined' || ch.state === 'joining');
          if (joined) {
            presenceChannel = joined;
            publishPresenceNames(joined.presenceState());
            return;
          }
          bindPresenceChannel();
        });
        return;
      }
      bindPresenceChannel();
    };

    setupPresenceSubscription();

    return () => {
      void teardownDashboardPresence();
    };
  }, [isAuthenticated, userId, currentGroupId]);

  useEffect(() => {
    const name = userName.trim();
    if (!isAuthenticated || !userId || !currentGroupId || !name) return;
    if (name === lastTrackedNameRef.current) return;
    const channel = presenceChannel;
    if (!channel?.track || channel.state !== 'joined') return;
    lastTrackedNameRef.current = name;
    void channel.track({
      userId,
      userName: name,
      groupId: currentGroupId,
      onlineAt: new Date().toISOString(),
    });
  }, [isAuthenticated, userId, currentGroupId, userName]);

  return (
    <OnlineUsersContext.Provider value={onlineUsers}>
      {children}
    </OnlineUsersContext.Provider>
  );
}

export function DashboardOnlineUsersStrip({
  userId,
  userName,
  familyRoleByUserId,
  lang,
  onCurrentUserClick,
}: {
  userId: string;
  userName: string;
  familyRoleByUserId: Record<string, 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null>;
  lang: LangCode;
  onCurrentUserClick: () => void;
}) {
  const onlineUsers = useOnlineUsers();
  const ct = (key: 'me_suffix' | 'loading') => getCommonTranslation(lang, key);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onlineUsers.map((user) => {
        const rawNick = (
          user.isCurrentUser ? (userName?.trim() || user.name.trim()) : user.name.trim()
        ) || '';
        const nicknamePart = rawNick && !isOpaqueIdLabel(rawNick, user.id) ? rawNick : '';
        const rolePart = familyRoleByUserId[user.id]
          ? `${getFamilyRoleEmoji(familyRoleByUserId[user.id])} ${getFamilyRoleLabel(lang, familyRoleByUserId[user.id])}`
          : '';
        return (
          <div
            key={user.id}
            className={`user-info rounded-md border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.1)] px-1.5 py-[3px] ${
              user.isCurrentUser ? 'cursor-pointer' : 'cursor-default'
            }`}
            onClick={user.isCurrentUser ? onCurrentUserClick : undefined}
          >
            <span className="user-icon text-xs">👤</span>
            <p className={`user-name m-0 text-xs ${user.isCurrentUser ? 'font-semibold' : 'font-medium'}`}>
              {nicknamePart ? `${nicknamePart} ` : ''}
              {rolePart}
              {user.isCurrentUser && ct('me_suffix')}
            </p>
          </div>
        );
      })}
      {onlineUsers.length === 0 && (
        <div className="user-info cursor-pointer" onClick={onCurrentUserClick}>
          <span className="user-icon">👤</span>
          <p className="user-name">
            {(() => {
              const nick = userName?.trim() || '';
              const role = familyRoleByUserId[userId]
                ? `${getFamilyRoleEmoji(familyRoleByUserId[userId])} ${getFamilyRoleLabel(lang, familyRoleByUserId[userId])}`
                : '';
              if (!nick && !role) return ct('loading');
              return (
                <>
                  {nick ? `${nick} ` : ''}
                  {role}
                  {ct('me_suffix')}
                </>
              );
            })()}
          </p>
        </div>
      )}
    </div>
  );
}
