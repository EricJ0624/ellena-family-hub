/**
 * 캘린더 일정 모달을 위젯 React 트리 밖에서 연다.
 * 모달이 FamilyCalendarSection 자식이면 클릭이 포탈이어도 React 트리를 타고
 * cqmin 월 그리드까지 다시 그려 Windows Chrome이 멈춘다.
 */

import type { FamilyEvent } from './types';
import type {
  CalendarEventModalTranslations,
  CalendarEventSubmitPayload,
} from './components/CalendarEventModal';

export type CalendarEventModalSnapshot = {
  isKidsTheme: boolean;
  initialDate: Date;
  editingEvent: FamilyEvent | null;
  translations: CalendarEventModalTranslations;
  sanitizeInput: (input: string | null | undefined, maxLength?: number) => string;
  onSubmit: (payload: CalendarEventSubmitPayload) => void;
};

type Listener = () => void;

let snapshot: CalendarEventModalSnapshot | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function openCalendarEventModal(next: CalendarEventModalSnapshot) {
  snapshot = next;
  emit();
}

export function closeCalendarEventModal() {
  if (snapshot == null) return;
  snapshot = null;
  emit();
}

export function getCalendarEventModalSnapshot() {
  return snapshot;
}

export function subscribeCalendarEventModal(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
