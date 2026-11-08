function mainContent(): HTMLElement | null {
  const el = document.querySelector('.main-content');
  return el instanceof HTMLElement ? el : null;
}

/** 패밀리 로그 카드를 열 때 대시보드 스크롤을 붙잡았다 놓는다. */
export function readMainContentScroll(): number | null {
  const el = mainContent();
  return el ? el.scrollTop : null;
}

export function writeMainContentScroll(top: number) {
  const el = mainContent();
  if (el) el.scrollTop = top;
}
