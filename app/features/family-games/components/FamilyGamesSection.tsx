'use client';

import React, { useCallback, useState } from 'react';
import type { FamilyTaskMemberOption } from '@/app/features/family-tasks/types';
import { formatGamesText } from '@/lib/translations/games';
import type { GameTab } from '../types';
import { LadderGameTab } from './LadderGameTab';
import { RPSGameTab } from './RPSGameTab';
import { RouletteGameTab } from './RouletteGameTab';

export interface FamilyGamesSectionProps {
  currentGroupId: string | null;
  userId: string;
  members: FamilyTaskMemberOption[];
  translations: {
    section_title: string;
    select_group: string;
    tab_ladder: string;
    tab_rps: string;
    tab_roulette: string;
    ladder_participants: string;
    ladder_destinations: string;
    ladder_participant_ph: string;
    ladder_destination_ph: string;
    select_member: string;
    no_members: string;
    ladder_add_pair: string;
    ladder_remove_pair: string;
    ladder_min_players: string;
    ladder_draw_hint: string;
    ladder_start_hint: string;
    ladder_drawn_by: string;
    ladder_draw_progress: string;
    ladder_you: string;
    ladder_start: string;
    ladder_reset: string;
    ladder_result_title: string;
    ladder_path_result: string;
    rps_player1: string;
    rps_player2: string;
    rps_rock: string;
    rps_paper: string;
    rps_scissors: string;
    rps_reveal: string;
    rps_reset: string;
    rps_select_members: string;
    rps_pick_choices: string;
    rps_pick_both: string;
    rps_animating: string;
    rps_result_win: string;
    rps_result_draw: string;
    duplicate_member: string;
    roulette_slots: string;
    roulette_participants: string;
    roulette_slots_per_member: string;
    roulette_slots_per_member_option: string;
    roulette_total_slots: string;
    roulette_select_participants: string;
    roulette_min_participants: string;
    roulette_spin: string;
    roulette_spinning: string;
    roulette_reset: string;
    roulette_result: string;
  };
}

const TABS: GameTab[] = ['ladder', 'rps', 'roulette'];

export function FamilyGamesSection({
  currentGroupId,
  userId,
  members,
  translations: t,
}: FamilyGamesSectionProps) {
  const [activeTab, setActiveTab] = useState<GameTab>('ladder');

  const formatText = useCallback(
    (template: string, vars: Record<string, string>) => formatGamesText(template, vars),
    [],
  );

  const tabLabel = (tab: GameTab) => {
    if (tab === 'ladder') return t.tab_ladder;
    if (tab === 'rps') return t.tab_rps;
    return t.tab_roulette;
  };

  return (
    <section className="content-section">
      <div className="section-header">
        <h3 className="section-title">{t.section_title}</h3>
      </div>
      <div className="section-body">
        {!currentGroupId ? (
          <div style={{ fontSize: '5cqmin' }} className="text-[#64748b]">
            {t.select_group}
          </div>
        ) : (
          <div className="grid" style={{ gap: '2.5cqmin' }}>
            <div
              className="flex flex-wrap rounded-xl bg-slate-900/5 p-1"
              role="tablist"
              style={{ gap: '1cqmin' }}
            >
              {TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-3 py-2 font-semibold transition-colors ${
                    activeTab === tab
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:bg-white/60'
                  }`}
                  style={{ fontSize: '4cqmin' }}
                >
                  {tabLabel(tab)}
                </button>
              ))}
            </div>

            {activeTab === 'ladder' && (
              <LadderGameTab
                userId={userId}
                members={members}
                translations={t}
                formatText={formatText}
              />
            )}
            {activeTab === 'rps' && (
              <RPSGameTab
                userId={userId}
                members={members}
                translations={t}
                formatText={formatText}
              />
            )}
            {activeTab === 'roulette' && (
              <RouletteGameTab
                userId={userId}
                members={members}
                translations={t}
                formatText={formatText}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
