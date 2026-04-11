/**
 * 대시보드용 가족 위치 단일 진입 — 섹션 + 요청 모달 (로직·상태는 부모)
 */

'use client';

import React from 'react';
import { FamilyLocationSection } from './FamilyLocationSection';
import type { FamilyLocationSectionTranslations } from './FamilyLocationSection';
import { FamilyLocationRequestModal } from './FamilyLocationRequestModal';
import type { FamilyLocationRequestModalTranslations } from './FamilyLocationRequestModal';
import type { DashboardLocationRequestRow, LocationModalOnlineUser, LocationModalUserRow } from '../types';

export type FamilyLocationDashboardBundleProps = {
  onOpenRequestModal: () => void;
  myLocation: {
    address: string;
    latitude?: number;
    longitude?: number;
  };
  extractLocationAddress: (address: string) => string;
  isLocationSharing: boolean;
  mapError: string | null;
  hasGoogleMapsApiKey: boolean;
  locationRequests: DashboardLocationRequestRow[];
  userId: string;
  onLocationRequestAction: (requestId: string, action: 'accept' | 'reject' | 'cancel') => void;
  onEndLocationSharing: (requestId: string) => void;
  sectionTranslations: FamilyLocationSectionTranslations;
  cancelLabel: string;
  rejectLabel: string;
  modalOpen: boolean;
  loadingUsers: boolean;
  allUsers: LocationModalUserRow[];
  onlineUsers: LocationModalOnlineUser[];
  onModalBackdropClose: () => void;
  onSendLocationRequest: (targetUserId: string) => void;
  onRefreshModalUsers: () => void;
  modalTranslations: FamilyLocationRequestModalTranslations;
  closeLabel: string;
};

export function FamilyLocationDashboardBundle({
  onOpenRequestModal,
  myLocation,
  extractLocationAddress,
  isLocationSharing,
  mapError,
  hasGoogleMapsApiKey,
  locationRequests,
  userId,
  onLocationRequestAction,
  onEndLocationSharing,
  sectionTranslations,
  cancelLabel,
  rejectLabel,
  modalOpen,
  loadingUsers,
  allUsers,
  onlineUsers,
  onModalBackdropClose,
  onSendLocationRequest,
  onRefreshModalUsers,
  modalTranslations,
  closeLabel,
}: FamilyLocationDashboardBundleProps) {
  return (
    <>
      <FamilyLocationSection
        onOpenRequestModal={onOpenRequestModal}
        myLocation={myLocation}
        extractLocationAddress={extractLocationAddress}
        isLocationSharing={isLocationSharing}
        mapError={mapError}
        hasGoogleMapsApiKey={hasGoogleMapsApiKey}
        locationRequests={locationRequests}
        userId={userId}
        onLocationRequestAction={onLocationRequestAction}
        onEndLocationSharing={onEndLocationSharing}
        translations={sectionTranslations}
        cancelLabel={cancelLabel}
        rejectLabel={rejectLabel}
      />
      <FamilyLocationRequestModal
        open={modalOpen}
        userId={userId}
        loadingUsers={loadingUsers}
        allUsers={allUsers}
        onlineUsers={onlineUsers}
        locationRequests={locationRequests}
        onBackdropClose={onModalBackdropClose}
        onSendLocationRequest={onSendLocationRequest}
        onRefreshUsers={onRefreshModalUsers}
        t={modalTranslations}
        closeLabel={closeLabel}
      />
    </>
  );
}
