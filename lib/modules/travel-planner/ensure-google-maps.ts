/**
 * Ensure Maps JavaScript API is on the page (shared by dashboard, planner, diary).
 * Safe to call multiple times; reuses existing script tag when present.
 */

const SCRIPT_ID = 'google-maps-script';
const MAX_POLLS = 100;
const POLL_MS = 100;

function mapsReady(): boolean {
  if (typeof window === 'undefined') return false;
  const g = (window as unknown as { google?: { maps?: { Map?: unknown } } }).google;
  return Boolean(g?.maps?.Map);
}

export function ensureGoogleMapsLoaded(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (mapsReady()) return Promise.resolve(true);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
  if (!apiKey) return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;
    let polls = 0;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearInterval(poll);
      resolve(ok);
    };
    const poll = window.setInterval(() => {
      polls += 1;
      if (mapsReady()) finish(true);
      else if (polls >= MAX_POLLS) finish(false);
    }, POLL_MS);

    const existing = document.querySelector(`script[src*="maps.googleapis.com/maps/api/js"]`);
    if (existing) return;

    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () => finish(false);
    document.head.appendChild(script);
  });
}
