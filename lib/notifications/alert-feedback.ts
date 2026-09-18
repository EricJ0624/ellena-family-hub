'use client';

import { HATSU_SOUND_URL, type FirstAlertMode, type SubsequentAlertMode } from './alert-modes';

let unlockedAudio: HTMLAudioElement | null = null;

/** 사용자 제스처에서 한 번 호출해 자동재생 정책 통과 */
export function unlockAlertAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    if (!unlockedAudio) {
      unlockedAudio = new Audio(HATSU_SOUND_URL);
      unlockedAudio.preload = 'auto';
    }
    unlockedAudio.muted = true;
    void unlockedAudio.play().then(() => {
      unlockedAudio?.pause();
      if (unlockedAudio) {
        unlockedAudio.currentTime = 0;
        unlockedAudio.muted = false;
      }
    }).catch(() => {
      /* ignore */
    });
  } catch {
    /* ignore */
  }
}

function playHatsuSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const audio = unlockedAudio ? unlockedAudio.cloneNode(true) as HTMLAudioElement : new Audio(HATSU_SOUND_URL);
    audio.volume = 1;
    void audio.play().catch(() => {
      /* 자동재생 차단 등 — 무시 */
    });
  } catch {
    /* ignore */
  }
}

function vibrateDevice(pattern: number | number[] = [180, 80, 180]): void {
  if (typeof navigator === 'undefined') return;
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}

/** 포그라운드 알림 피드백 (하쓰음 / 진동 / 무음) */
export function playForegroundAlertFeedback(
  mode: FirstAlertMode | SubsequentAlertMode,
): void {
  if (mode === 'voice') {
    playHatsuSound();
    return;
  }
  if (mode === 'vibrate') {
    vibrateDevice();
    return;
  }
  /* silent */
}
