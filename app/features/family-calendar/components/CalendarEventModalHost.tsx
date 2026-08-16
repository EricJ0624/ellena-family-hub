'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  closeCalendarEventModal,
  getCalendarEventModalSnapshot,
  subscribeCalendarEventModal,
} from '../calendar-event-modal-store';
import { CalendarEventModal } from './CalendarEventModal';
import type { CalendarEventSubmitPayload } from './CalendarEventModal';

/**
 * 루트 레이아웃에 마운트한다. 대시보드/캘린더 위젯과 형제라서
 * 모달 폼 setState가 cqmin 그리드를 다시 그리지 않는다.
 */
export function CalendarEventModalHost() {
  const [snap, setSnap] = useState(getCalendarEventModalSnapshot);
  const snapRef = useRef(snap);
  snapRef.current = snap;

  useEffect(() => subscribeCalendarEventModal(() => setSnap(getCalendarEventModalSnapshot())), []);

  const handleSubmit = useCallback((payload: CalendarEventSubmitPayload) => {
    const submit = snapRef.current?.onSubmit;
    closeCalendarEventModal();
    submit?.(payload);
  }, []);

  if (!snap) return null;

  const modalKey = snap.editingEvent
    ? `edit-${String(snap.editingEvent.id)}`
    : `new-${snap.initialDate.getTime()}`;

  return (
    <CalendarEventModal
      key={modalKey}
      open
      isKidsTheme={snap.isKidsTheme}
      initialDate={snap.initialDate}
      editingEvent={snap.editingEvent}
      translations={snap.translations}
      sanitizeInput={snap.sanitizeInput}
      onClose={closeCalendarEventModal}
      onSubmit={handleSubmit}
    />
  );
}
