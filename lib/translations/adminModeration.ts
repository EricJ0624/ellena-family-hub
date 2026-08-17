import type { LangCode } from '@/lib/language-fonts';

export type AdminModerationTranslations = {
  title: string;
  empty: string;
  scope_group: string;
  scope_user: string;
  reply_placeholder: string;
  send: string;
  failed: string;
  delete_thread: string;
  confirm_delete_thread: string;
  delete_failed: string;
};

const t: Record<LangCode, AdminModerationTranslations> = {
  ko: {
    title: '정지 문의',
    empty: '정지 문의가 없습니다.',
    scope_group: '그룹 전체',
    scope_user: '회원',
    reply_placeholder: '답장을 적어 주세요.',
    send: '보내기',
    failed: '답장을 보내지 못했습니다.',
    delete_thread: '문의 삭제',
    confirm_delete_thread: '이 문의 실 전체를 삭제할까요? 정지 해제 후에도 복구할 수 없습니다.',
    delete_failed: '삭제하지 못했습니다.',
  },
  en: {
    title: 'Suspension inquiries',
    empty: 'No suspension inquiries.',
    scope_group: 'Whole group',
    scope_user: 'Member',
    reply_placeholder: 'Write a reply.',
    send: 'Send',
    failed: 'Could not send the reply.',
    delete_thread: 'Delete inquiry',
    confirm_delete_thread: 'Delete this entire inquiry? It cannot be restored after unsuspend.',
    delete_failed: 'Could not delete.',
  },
  ja: {
    title: '停止の問い合わせ',
    empty: '停止の問い合わせはありません。',
    scope_group: 'グループ全体',
    scope_user: '会員',
    reply_placeholder: '返信を書いてください。',
    send: '送信',
    failed: '返信を送れませんでした。',
    delete_thread: '問い合わせを削除',
    confirm_delete_thread: 'この問い合わせ全体を削除しますか？停止解除後も復元できません。',
    delete_failed: '削除できませんでした。',
  },
  'zh-CN': {
    title: '停用咨询',
    empty: '暂无停用咨询。',
    scope_group: '整个群组',
    scope_user: '成员',
    reply_placeholder: '请填写回复。',
    send: '发送',
    failed: '回复发送失败。',
    delete_thread: '删除咨询',
    confirm_delete_thread: '删除整条咨询？解除停用后也无法恢复。',
    delete_failed: '删除失败。',
  },
  'zh-TW': {
    title: '停用諮詢',
    empty: '暫無停用諮詢。',
    scope_group: '整個群組',
    scope_user: '成員',
    reply_placeholder: '請填寫回覆。',
    send: '送出',
    failed: '回覆送出失敗。',
    delete_thread: '刪除諮詢',
    confirm_delete_thread: '刪除整則諮詢？解除停用後也無法復原。',
    delete_failed: '刪除失敗。',
  },
  es: {
    title: 'Consultas de suspensión',
    empty: 'No hay consultas de suspensión.',
    scope_group: 'Grupo entero',
    scope_user: 'Miembro',
    reply_placeholder: 'Escriba una respuesta.',
    send: 'Enviar',
    failed: 'No se pudo enviar.',
    delete_thread: 'Eliminar consulta',
    confirm_delete_thread: '¿Eliminar toda la consulta? No se podrá restaurar después de reactivar.',
    delete_failed: 'No se pudo eliminar.',
  },
  fr: {
    title: 'Demandes de suspension',
    empty: 'Aucune demande de suspension.',
    scope_group: 'Groupe entier',
    scope_user: 'Membre',
    reply_placeholder: 'Écrivez une réponse.',
    send: 'Envoyer',
    failed: 'Envoi impossible.',
    delete_thread: 'Supprimer la demande',
    confirm_delete_thread: 'Supprimer toute la demande ? Impossible de la restaurer après la réactivation.',
    delete_failed: 'Suppression impossible.',
  },
  de: {
    title: 'Sperr-Anfragen',
    empty: 'Keine Sperr-Anfragen.',
    scope_group: 'Ganze Gruppe',
    scope_user: 'Mitglied',
    reply_placeholder: 'Antwort schreiben.',
    send: 'Senden',
    failed: 'Senden fehlgeschlagen.',
    delete_thread: 'Anfrage löschen',
    confirm_delete_thread: 'Die gesamte Anfrage löschen? Nach der Entsperrung nicht wiederherstellbar.',
    delete_failed: 'Löschen fehlgeschlagen.',
  },
  it: {
    title: 'Richieste di sospensione',
    empty: 'Nessuna richiesta di sospensione.',
    scope_group: 'Intero gruppo',
    scope_user: 'Membro',
    reply_placeholder: 'Scrivete una risposta.',
    send: 'Invia',
    failed: 'Invio non riuscito.',
    delete_thread: 'Elimina richiesta',
    confirm_delete_thread: 'Eliminare l’intera richiesta? Non sarà ripristinabile dopo la riattivazione.',
    delete_failed: 'Eliminazione non riuscita.',
  },
  pt: {
    title: 'Pedidos de suspensão',
    empty: 'Não há pedidos de suspensão.',
    scope_group: 'Grupo inteiro',
    scope_user: 'Membro',
    reply_placeholder: 'Escreva uma resposta.',
    send: 'Enviar',
    failed: 'Não foi possível enviar.',
    delete_thread: 'Excluir pedido',
    confirm_delete_thread: 'Excluir todo o pedido? Não será possível restaurar após reativar.',
    delete_failed: 'Não foi possível excluir.',
  },
};

export function getAdminModerationTranslation(
  lang: LangCode,
  key: keyof AdminModerationTranslations,
): string {
  return t[lang]?.[key] ?? t.en[key] ?? t.ko[key] ?? key;
}
