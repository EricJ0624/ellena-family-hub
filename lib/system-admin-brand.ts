/**
 * Hearth Biker 전용: 사용자에게 보이는 "시스템 관리자" 계열 표시명을 Rider X 로 통일.
 * CURRENT_APP_ID === hearth_biker 일 때만 동작. 다른 앱·코드 식별자·주석은 변경하지 않음.
 */
import { APP_IDS, CURRENT_APP_ID } from '@/lib/apps';

export const RIDER_X_LABEL = 'Rider X';

export function isHearthBikerApp(): boolean {
  return CURRENT_APP_ID === APP_IDS.BIKER;
}

/** 대시보드 시스템 관리자 버튼 라벨 (그룹 관리자 버튼은 fallback 유지) */
export function systemAdminButtonLabel(fallback: string): string {
  return isHearthBikerApp() ? RIDER_X_LABEL : fallback;
}

/**
 * UI/API 사용자 노출 문구에서 시스템 관리자 역할명을 Rider X 로 치환.
 * Biker가 아니면 원문 그대로 반환.
 */
export function brandSystemAdminCopy(text: string): string {
  if (!isHearthBikerApp() || !text) return text;

  let out = text;

  const pairs: [RegExp, string][] = [
    // 긴 형태 우선
    [/Systemadministratorseite/gi, `${RIDER_X_LABEL}`],
    [/Systemadministratoren/gi, RIDER_X_LABEL],
    [/Systemadministrators?/gi, RIDER_X_LABEL],
    [/system\s+administrators?/gi, RIDER_X_LABEL],
    [/System\s+admins?/gi, RIDER_X_LABEL],
    [/시스템\s*관리자들?/g, RIDER_X_LABEL],
    [/システム管理者/g, RIDER_X_LABEL],
    [/系统管理员/g, RIDER_X_LABEL],
    [/系統管理員/g, RIDER_X_LABEL],
    [/Administradores?\s+del\s+sistema/gi, RIDER_X_LABEL],
    [/Administrador(?:es)?\s+del\s+sistema/gi, RIDER_X_LABEL],
    [/Administrateurs?\s+système/gi, RIDER_X_LABEL],
    [/Administrateur\s+système/gi, RIDER_X_LABEL],
    [/Amministratori?\s+di\s+sistema/gi, RIDER_X_LABEL],
    [/Administradores?\s+do\s+sistema/gi, RIDER_X_LABEL],
    [/administrador(?:es)?\s+do\s+sistema/gi, RIDER_X_LABEL],
    [/un\s+administrateur\s+système/gi, RIDER_X_LABEL],
    [/un\s+amministratore\s+di\s+sistema/gi, RIDER_X_LABEL],
    [/un\s+administrador\s+del\s+sistema/gi, RIDER_X_LABEL],
  ];

  for (const [re, replacement] of pairs) {
    out = out.replace(re, replacement);
  }

  // 짧은 버튼 라벨(시스템 관리자 축약형) — 문장 속 "시스템 관리 및 …" 는 건드리지 않음
  const trimmed = out.trim();
  if (
    trimmed === '시스템 관리' ||
    trimmed === 'システム管理' ||
    trimmed === '系统管理' ||
    trimmed === '系統管理'
  ) {
    return RIDER_X_LABEL;
  }

  return out;
}
