const SCROLL_KEY = 'ellena-dashboard-main-scroll';

function mainContent(): HTMLElement | null {
  const el = document.querySelector('.main-content');
  return el instanceof HTMLElement ? el : null;
}

export function readMainContentScroll(): number | null {
  const el = mainContent();
  return el ? el.scrollTop : null;
}

export function writeMainContentScroll(top: number) {
  const el = mainContent();
  if (el) el.scrollTop = top;
}

/** 일기 화면으로 나가기 직전, 대시보드 스크롤 위치를 남긴다. */
export function rememberDashboardScroll() {
  if (typeof document === 'undefined') return;
  const el = mainContent();
  if (!el) return;
  sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop));
}

/**
 * 대시보드가 다시 붙을 때 저장한 위치로 되돌린다.
 * 위젯 높이가 늦게 잡히면 그 위치까지 내용이 생긴 뒤에 맞춘다.
 */
export function restoreDashboardScroll() {
  if (typeof document === 'undefined') return;
  const raw = sessionStorage.getItem(SCROLL_KEY);
  if (raw == null) return;
  const top = Number(raw);
  if (!Number.isFinite(top) || top < 0) {
    sessionStorage.removeItem(SCROLL_KEY);
    return;
  }
  let tries = 0;
  const tick = () => {
    const el = mainContent();
    if (el && el.scrollHeight >= el.clientHeight + top - 4) {
      el.scrollTop = top;
    }
    tries += 1;
    if (tries > 90) {
      sessionStorage.removeItem(SCROLL_KEY);
      return;
    }
    requestAnimationFrame(tick);
  };
  tick();
}
