import type { LangCode } from '@/lib/language-fonts';

export type GroupEmailInviteTranslations = {
  modal_title: string;
  /** `{group}` — 그룹 이름 */
  modal_body: string;
  /** `{name}` — 초대한 사람 */
  modal_invited_by: string;
  accept_btn: string;
  reject_btn: string;
  accepting: string;
  rejecting: string;
  accept_failed: string;
  reject_failed: string;
  suspended_group: string;
  expired: string;
};

const translations: Record<LangCode, GroupEmailInviteTranslations> = {
  ko: {
    modal_title: '그룹 초대',
    modal_body: '「{group}」 그룹에 초대되었습니다.',
    modal_invited_by: '{name}님이 초대했습니다.',
    accept_btn: '수락하고 참여',
    reject_btn: '거절',
    accepting: '참여 중…',
    rejecting: '처리 중…',
    accept_failed: '초대 수락에 실패했습니다.',
    reject_failed: '초대 거절에 실패했습니다.',
    suspended_group: '이 그룹은 현재 이용할 수 없습니다.',
    expired: '초대가 만료되었습니다.',
  },
  en: {
    modal_title: 'Group invitation',
    modal_body: 'You have been invited to join "{group}".',
    modal_invited_by: 'Invited by {name}.',
    accept_btn: 'Accept and join',
    reject_btn: 'Decline',
    accepting: 'Joining…',
    rejecting: 'Processing…',
    accept_failed: 'Could not accept the invitation.',
    reject_failed: 'Could not decline the invitation.',
    suspended_group: 'This group is currently unavailable.',
    expired: 'This invitation has expired.',
  },
  ja: {
    modal_title: 'グループ招待',
    modal_body: '「{group}」グループに招待されました。',
    modal_invited_by: '{name}さんからの招待です。',
    accept_btn: '承諾して参加',
    reject_btn: '拒否',
    accepting: '参加中…',
    rejecting: '処理中…',
    accept_failed: '招待の承諾に失敗しました。',
    reject_failed: '招待の拒否に失敗しました。',
    suspended_group: 'このグループは現在利用できません。',
    expired: '招待の有効期限が切れています。',
  },
  'zh-CN': {
    modal_title: '群组邀请',
    modal_body: '您已被邀请加入「{group}」。',
    modal_invited_by: '由 {name} 邀请。',
    accept_btn: '接受并加入',
    reject_btn: '拒绝',
    accepting: '加入中…',
    rejecting: '处理中…',
    accept_failed: '无法接受邀请。',
    reject_failed: '无法拒绝邀请。',
    suspended_group: '该群组目前不可用。',
    expired: '邀请已过期。',
  },
  'zh-TW': {
    modal_title: '群組邀請',
    modal_body: '您已被邀請加入「{group}」。',
    modal_invited_by: '由 {name} 邀請。',
    accept_btn: '接受並加入',
    reject_btn: '拒絕',
    accepting: '加入中…',
    rejecting: '處理中…',
    accept_failed: '無法接受邀請。',
    reject_failed: '無法拒絕邀請。',
    suspended_group: '此群組目前無法使用。',
    expired: '邀請已過期。',
  },
  es: {
    modal_title: 'Invitación al grupo',
    modal_body: 'Has sido invitado a unirte a «{group}».',
    modal_invited_by: 'Invitado por {name}.',
    accept_btn: 'Aceptar y unirse',
    reject_btn: 'Rechazar',
    accepting: 'Uniéndose…',
    rejecting: 'Procesando…',
    accept_failed: 'No se pudo aceptar la invitación.',
    reject_failed: 'No se pudo rechazar la invitación.',
    suspended_group: 'Este grupo no está disponible.',
    expired: 'La invitación ha expirado.',
  },
  fr: {
    modal_title: 'Invitation au groupe',
    modal_body: 'Vous avez été invité à rejoindre « {group} ».',
    modal_invited_by: 'Invitation de {name}.',
    accept_btn: 'Accepter et rejoindre',
    reject_btn: 'Refuser',
    accepting: 'Adhésion…',
    rejecting: 'Traitement…',
    accept_failed: 'Impossible d\'accepter l\'invitation.',
    reject_failed: 'Impossible de refuser l\'invitation.',
    suspended_group: 'Ce groupe est indisponible.',
    expired: 'L\'invitation a expiré.',
  },
  de: {
    modal_title: 'Gruppeneinladung',
    modal_body: 'Sie wurden eingeladen, «{group}» beizutreten.',
    modal_invited_by: 'Eingeladen von {name}.',
    accept_btn: 'Annehmen und beitreten',
    reject_btn: 'Ablehnen',
    accepting: 'Beitritt…',
    rejecting: 'Wird verarbeitet…',
    accept_failed: 'Einladung konnte nicht angenommen werden.',
    reject_failed: 'Einladung konnte nicht abgelehnt werden.',
    suspended_group: 'Diese Gruppe ist derzeit nicht verfügbar.',
    expired: 'Die Einladung ist abgelaufen.',
  },
  it: {
    modal_title: 'Invito al gruppo',
    modal_body: 'Sei stato invitato a unirti a «{group}».',
    modal_invited_by: 'Invitato da {name}.',
    accept_btn: 'Accetta e unisciti',
    reject_btn: 'Rifiuta',
    accepting: 'Accesso…',
    rejecting: 'Elaborazione…',
    accept_failed: 'Impossibile accettare l\'invito.',
    reject_failed: 'Impossibile rifiutare l\'invito.',
    suspended_group: 'Questo gruppo non è disponibile.',
    expired: 'L\'invito è scaduto.',
  },
  pt: {
    modal_title: 'Convite para o grupo',
    modal_body: 'Você foi convidado para participar de «{group}».',
    modal_invited_by: 'Convite de {name}.',
    accept_btn: 'Aceitar e entrar',
    reject_btn: 'Recusar',
    accepting: 'Entrando…',
    rejecting: 'Processando…',
    accept_failed: 'Não foi possível aceitar o convite.',
    reject_failed: 'Não foi possível recusar o convite.',
    suspended_group: 'Este grupo não está disponível.',
    expired: 'O convite expirou.',
  },
};

export function getGroupEmailInviteTranslation(
  lang: LangCode,
  key: keyof GroupEmailInviteTranslations,
): string {
  return translations[lang]?.[key] ?? translations.en[key];
}

export function formatGroupEmailInviteText(
  template: string,
  vars: { group?: string; name?: string },
): string {
  return template
    .replace(/\{group\}/g, vars.group ?? '')
    .replace(/\{name\}/g, vars.name ?? '');
}
