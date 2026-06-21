/**
 * 가족 위치(Family Location) 타입 정의
 * 대시보드 `locationRequests` / 모달 사용자 목록과 동일한 형태를 유지합니다.
 */

export type LocationRequestType = 'where' | 'come_here';

export type DashboardLocationRequestRow = {
  id: string;
  requester_id: string;
  target_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  request_type?: LocationRequestType;
  destination_lat?: number | null;
  destination_lng?: number | null;
  created_at: string;
  expires_at?: string;
  requester?: { id: string; email: string; nickname?: string | null };
  target?: { id: string; email: string; nickname?: string | null };
};

export type LocationModalUserRow = {
  id: string;
  email: string;
  nickname: string | null;
};

export type LocationModalOnlineUser = { id: string; name: string; isCurrentUser: boolean };

/** 레거시/문서용 — UI는 DashboardLocationRequestRow 사용 */
export type FamilyLocation = {
  userId: string;
  userName: string;
  address: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
  familyRole?: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null;
};

export type LocationData = {
  latitude: number;
  longitude: number;
  address: string;
  lastUpdated: string;
};

/** useFamilyLocation 훅 등 DB 스키마 정렬용 (대시보드 UI 행과 별도) */
export type LocationRequest = {
  id: string;
  requester_id: string;
  target_user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
};
