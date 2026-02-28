/**
 * 대시보드·앨범 공용 저장소/암호화 유틸 (대시보드와 AlbumContext에서 사용)
 */
import CryptoJS from 'crypto-js';

const CONFIG = { STORAGE: 'SFH_DATA_V5', AUTH: 'SFH_AUTH' };

export const getStorageKey = (userId: string, groupId?: string | null) =>
  groupId ? `${CONFIG.STORAGE}_${userId}_${groupId}` : `${CONFIG.STORAGE}_${userId}`;

export const getAuthKey = (userId: string) => `${CONFIG.AUTH}_${userId}`;

export const CryptoService = {
  encrypt: (data: unknown, key: string) =>
    CryptoJS.AES.encrypt(JSON.stringify(data), key).toString(),
  decrypt: (cipher: string, key: string): unknown => {
    try {
      if (!cipher || !key) return null;
      if (!cipher.startsWith('U2FsdGVkX1')) return cipher;
      const bytes = CryptoJS.AES.decrypt(cipher, key);
      const raw = bytes.toString(CryptoJS.enc.Utf8);
      if (!raw || raw.length === 0) return null;
      try {
        const parsed = JSON.parse(raw);
        return typeof parsed === 'string' ? parsed : parsed;
      } catch {
        return raw;
      }
    } catch (e: unknown) {
      const msg = (e as Error)?.message || '';
      if (msg.includes('Malformed UTF-8') || msg.includes('UTF-8')) return null;
      if (process.env.NODE_ENV === 'development') {
        console.warn('복호화 실패:', msg);
      }
      return null;
    }
  },
};
