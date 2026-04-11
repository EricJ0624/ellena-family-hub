/**
 * 가족 위치(Family Location) 타입 정의
 */

export type FamilyLocation = {
  userId: string;
  userName: string;
  address: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
  familyRole?: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null;
};

export type LocationRequest = {
  id: string;
  requester_id: string;
  target_user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
};

export type LocationData = {
  latitude: number;
  longitude: number;
  address: string;
  lastUpdated: string;
};
