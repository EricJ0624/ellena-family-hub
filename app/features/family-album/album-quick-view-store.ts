/**
 * 위젯에 이미 떠 있는 사진을 대시보드 state 밖에서 바로 보여 준다.
 * 대시보드 페이지 setState로 띄우면 cqmin 위젯이 통째로 다시 그려진다.
 */

type Listener = () => void;

let src: string | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function showAlbumQuickView(nextSrc: string) {
  if (!nextSrc || src === nextSrc) return;
  src = nextSrc;
  emit();
}

export function hideAlbumQuickView() {
  if (src == null) return;
  src = null;
  emit();
}

export function getAlbumQuickViewSrc() {
  return src;
}

export function subscribeAlbumQuickView(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
