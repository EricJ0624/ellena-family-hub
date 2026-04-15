/**
 * Piggy Bank 타입 정의
 */

export interface PiggySummary {
  name: string;
  walletBalance: number;
  bankBalance: number;
  currency: string;
  ownerNickname?: string | null;
}

export interface PiggyMember {
  user_id: string;
  ownerNickname: string | null;
  noAccount: true;
}

export interface PiggyAccount extends Omit<PiggyMember, 'noAccount'> {
  id: string;
  name: string;
  balance: number;
  walletBalance?: number;
  currency: string;
  noAccount: false;
}

export type PiggyMemberOrAccount = PiggyMember | PiggyAccount;

export interface AccountRequest {
  id: string;
  user_id: string;
  nickname: string | null;
}
