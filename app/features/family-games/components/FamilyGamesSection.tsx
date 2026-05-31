'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { FamilyTaskMemberOption } from '@/app/features/family-tasks/types';
import { formatGamesText } from '@/lib/translations/games';
import type { GameTab } from '../types';
import { useFamilyGameSession } from '../hooks/useFamilyGameSession';
import { GamePlayModal } from './GamePlayModal';
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
    games_launch: string;
    games_modal_close: string;
    games_session_active: string;
    games_join: string;
    games_cancel: string;
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
    rps_waiting_opponent: string;
    rps_you_submitted: string;
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
    roulette_confirm_join: string;
    roulette_waiting_ready: string;
    games_waiting_host: string;
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
  const [modalOpen, setModalOpen] = useState(false);

  const {
    bundle,
    createSession,
    performAction,
    cancelSession,
    actionLoading,
    isHost,
    hasActiveSession,
    error: sessionError,
  } = useFamilyGameSession({ groupId: currentGroupId, userId });

  const formatText = useCallback(
    (template: string, vars: Record<string, string>) => formatGamesText(template, vars),
    [],
  );

  const tabLabel = (tab: GameTab) => {
    if (tab === 'ladder') return t.tab_ladder;
    if (tab === 'rps') return t.tab_rps;
    return t.tab_roulette;
  };

  const modalTitle = useMemo(() => {
    if (!bundle) return '';
    if (bundle.session.game_type === 'ladder') return t.tab_ladder;
    if (bundle.session.game_type === 'rps') return t.tab_rps;
    return t.tab_roulette;
  }, [bundle, t.tab_ladder, t.tab_rps, t.tab_roulette]);

  const openModal = () => setModalOpen(true);
  const closePlayModal = () => setModalOpen(false);

  const handleCancelSession = async () => {
    if (!isHost || !bundle) return;
    await cancelSession();
    closePlayModal();
  };

  const handleCancelFromBanner = async () => {
    if (!isHost) return;
    await cancelSession();
  };

  const startLadder = async (config: { participantIds: string[]; destinations: string[] }) => {
    if (!currentGroupId) return;
    await createSession({ groupId: currentGroupId, gameType: 'ladder', config });
    openModal();
  };

  const startRPS = async (config: { p1UserId: string; p2UserId: string }) => {
    if (!currentGroupId) return;
    await createSession({ groupId: currentGroupId, gameType: 'rps', config });
    openModal();
  };

  const startRoulette = async (config: { selectedIds: string[]; slotsPerMember: number }) => {
    if (!currentGroupId) return;
    await createSession({ groupId: currentGroupId, gameType: 'roulette', config });
    openModal();
  };

  return (
    <>
      <section className="content-section games-widget-section">
        <div className="section-header">
          <h3 className="section-title">{t.section_title}</h3>
        </div>
        <div className="section-body games-section-body">
          {!currentGroupId ? (
            <div style={{ fontSize: '5cqmin' }} className="text-[#64748b]">
              {t.select_group}
            </div>
          ) : (
            <div className="games-widget-content">
              {hasActiveSession && !modalOpen && (
                <div
                  className="mb-2 flex flex-col rounded-xl bg-indigo-50 px-3 py-2"
                  style={{ gap: '1.5cqmin' }}
                >
                  <span className="font-medium text-indigo-800" style={{ fontSize: '4cqmin' }}>
                    {t.games_session_active}
                  </span>
                  <div className="flex flex-wrap" style={{ gap: '1cqmin' }}>
                    <button
                      type="button"
                      onClick={openModal}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white"
                      style={{ fontSize: '4cqmin' }}
                    >
                      {t.games_join}
                    </button>
                    {isHost && (
                      <button
                        type="button"
                        onClick={handleCancelFromBanner}
                        disabled={actionLoading}
                        className="rounded-lg bg-slate-200 px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-50"
                        style={{ fontSize: '4cqmin' }}
                      >
                        {t.games_cancel}
                      </button>
                    )}
                  </div>
                  {!isHost && (
                    <span className="text-indigo-700/80" style={{ fontSize: '3.5cqmin' }}>
                      {t.games_waiting_host}
                    </span>
                  )}
                </div>
              )}

              {sessionError && (
                <p className="text-red-600" style={{ fontSize: '3.5cqmin' }}>
                  {sessionError}
                </p>
              )}

              <div
                className="games-tab-bar flex flex-shrink-0 flex-wrap rounded-xl bg-slate-900/5 p-1"
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
                  mode="setup"
                  userId={userId}
                  members={members}
                  translations={t}
                  formatText={formatText}
                  launchLabel={t.games_launch}
                  onLaunch={startLadder}
                  disabled={hasActiveSession}
                />
              )}
              {activeTab === 'rps' && (
                <RPSGameTab
                  mode="setup"
                  userId={userId}
                  members={members}
                  translations={t}
                  formatText={formatText}
                  launchLabel={t.games_launch}
                  onLaunch={startRPS}
                  disabled={hasActiveSession}
                />
              )}
              {activeTab === 'roulette' && (
                <RouletteGameTab
                  mode="setup"
                  userId={userId}
                  members={members}
                  translations={t}
                  formatText={formatText}
                  launchLabel={t.games_launch}
                  onLaunch={startRoulette}
                  disabled={hasActiveSession}
                />
              )}
            </div>
          )}
        </div>
      </section>

      <GamePlayModal
        open={modalOpen && bundle !== null}
        title={modalTitle}
        closeLabel={t.games_modal_close}
        onClose={closePlayModal}
      >
        {bundle?.session.game_type === 'ladder' && (
          <LadderGameTab
            mode="multiplayer"
            userId={userId}
            members={members}
            translations={t}
            formatText={formatText}
            sessionBundle={bundle}
            isHost={isHost}
            onAction={performAction}
            actionLoading={actionLoading}
            onCancel={isHost ? handleCancelSession : undefined}
            cancelLabel={t.games_cancel}
          />
        )}
        {bundle?.session.game_type === 'rps' && (
          <RPSGameTab
            mode="multiplayer"
            userId={userId}
            members={members}
            translations={t}
            formatText={formatText}
            sessionBundle={bundle}
            isHost={isHost}
            onAction={performAction}
            actionLoading={actionLoading}
            onCancel={isHost ? handleCancelSession : undefined}
            cancelLabel={t.games_cancel}
          />
        )}
        {bundle?.session.game_type === 'roulette' && (
          <RouletteGameTab
            mode="multiplayer"
            userId={userId}
            members={members}
            translations={t}
            formatText={formatText}
            sessionBundle={bundle}
            isHost={isHost}
            onAction={performAction}
            actionLoading={actionLoading}
            onCancel={isHost ? handleCancelSession : undefined}
            cancelLabel={t.games_cancel}
          />
        )}
      </GamePlayModal>
    </>
  );
}
