import { supabase } from '@/lib/supabase';
import { applyPresetToWidget } from '@/lib/widgets/layout-presets';
import { ensureWidgetConfigs, saveWidgetConfigs, writeWidgetConfigCache } from '@/lib/widgets/widget-configs';
import { dispatchWidgetConfigsUpdated } from '@/lib/widgets/widget-config-events';
import type { DashboardWidgetKey, WidgetConfigDraft } from '@/lib/widgets/types';

/**
 * 쇼룸 저장용 레이아웃.
 * x/y를 연속 패킹하면 layout_h가 다른 위젯(예: travel=6, diary=8)이
 * CSS grid 행으로 변환될 때 같은 칸에 겹쳐 가려질 수 있음.
 * 레거시 그룹과 같이 x/y는 null(auto-flow), w/h만 프리셋으로 둔다.
 */
function draftsForShowroomSave(
  current: WidgetConfigDraft[],
  selected: ReadonlySet<DashboardWidgetKey>,
): WidgetConfigDraft[] {
  return current.map((c) => {
    const enabled = selected.has(c.widget_key);
    if (!enabled) {
      return {
        ...c,
        is_enabled: false,
        layoutX: null,
        layoutY: null,
        layoutPortraitX: null,
        layoutPortraitY: null,
        layoutLandscapeX: null,
        layoutLandscapeY: null,
      };
    }
    const withPreset = applyPresetToWidget({ ...c, is_enabled: true });
    return {
      ...withPreset,
      is_enabled: true,
      layoutX: null,
      layoutY: null,
      layoutPortraitX: null,
      layoutPortraitY: null,
      layoutLandscapeX: null,
      layoutLandscapeY: null,
    };
  });
}

/**
 * 쇼룸 선택분 on 저장 + 그룹 쇼룸 완료 플래그.
 * 기존 on/off·레이아웃 저장 경로(saveWidgetConfigs) 재사용.
 */
export async function completeWidgetShowroom(params: {
  groupId: string;
  selectedKeys: readonly DashboardWidgetKey[];
}): Promise<void> {
  const { groupId, selectedKeys } = params;
  if (selectedKeys.length === 0) {
    throw new Error('WIDGET_SHOWROOM_EMPTY_SELECTION');
  }

  const selected = new Set(selectedKeys);
  const current = await ensureWidgetConfigs(groupId, true);
  const drafts = draftsForShowroomSave(current, selected);

  await saveWidgetConfigs(groupId, drafts);
  writeWidgetConfigCache(groupId, drafts);

  const completedAt = new Date().toISOString();
  const { error } = await supabase
    .from('groups')
    .update({ widget_showroom_completed_at: completedAt })
    .eq('id', groupId);

  if (error) throw error;

  dispatchWidgetConfigsUpdated();
}
