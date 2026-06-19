import { isDefaultAppTitleText } from '@/lib/translations/common';

/** DB NOT NULL placeholder — UI에 노출하지 않음 */
export const DISPLAY_NAME_PENDING_SENTINEL = '__display_name_pending__';

export type GroupDisplayNameFields = {
  name?: string | null;
  family_name?: string | null;
  title_style?: unknown;
  display_name_pending?: boolean | null;
};

function parseTitleStyleContent(titleStyle: unknown): string | null {
  if (titleStyle && typeof titleStyle === 'object' && 'content' in (titleStyle as object)) {
    const content = (titleStyle as { content?: unknown }).content;
    if (typeof content === 'string' && content.trim()) return content.trim();
  }
  return null;
}

/** 그룹 표시 이름이 아직 정해지지 않았는지 */
export function isGroupDisplayNamePending(
  group: GroupDisplayNameFields | null | undefined,
): boolean {
  if (!group) return true;
  if (group.display_name_pending === true) return true;
  const trimmed = group.name?.trim() ?? '';
  return trimmed === '' || trimmed === DISPLAY_NAME_PENDING_SENTINEL;
}

/** 사용자가 설정한 표시 이름 (pending·기본 app_title 문자열 제외). 없으면 null */
export function getGroupDisplayNameRaw(
  group: GroupDisplayNameFields | null | undefined,
): string | null {
  if (!group || isGroupDisplayNamePending(group)) return null;

  const name = group.name?.trim();
  if (name && name !== DISPLAY_NAME_PENDING_SENTINEL && !isDefaultAppTitleText(name)) {
    return name;
  }

  const family = group.family_name?.trim();
  if (family && !isDefaultAppTitleText(family)) return family;

  const fromStyle = parseTitleStyleContent(group.title_style);
  if (fromStyle && !isDefaultAppTitleText(fromStyle)) return fromStyle;

  return null;
}

/** 대시보드 h1 문구 — pending이면 appTitle(i18n), 아니면 사용자 이름 그대로 */
export function getDashboardTitleText(
  group: GroupDisplayNameFields | null | undefined,
  appTitle: string,
): string {
  const raw = getGroupDisplayNameRaw(group);
  return raw ?? appTitle;
}

/** 기본 app_title 스타일(AppTitleContent·그라데이션)을 쓸지 */
export function shouldUseDefaultDashboardTitleStyle(
  group: GroupDisplayNameFields | null | undefined,
): boolean {
  return isGroupDisplayNamePending(group) || getGroupDisplayNameRaw(group) === null;
}

/** 바로크 액자 매트 캡션용 — pending이면 Hearth, 아니면 사용자 이름 */
export function getFrameCaptionName(
  group: GroupDisplayNameFields | null | undefined,
): string {
  const raw = getGroupDisplayNameRaw(group);
  return raw ?? 'Hearth';
}

/** 그룹 선택·관리 UI 라벨 — pending·placeholder 제외, family_name 등 표시 규칙과 동일 */
export function getGroupSelectorLabel(
  group: GroupDisplayNameFields | null | undefined,
  appTitle: string,
): string {
  return getGroupDisplayNameRaw(group) ?? appTitle;
}
