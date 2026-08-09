/** Google Static Maps URL for itinerary PDF/preview (client + server). */

export type MapPoint = {
  lat: number;
  lng: number;
  label?: string;
};

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function collectTripMapPoints(sources: {
  accommodations?: Array<{ latitude?: number | null; longitude?: number | null; name?: string | null }>;
  dining?: Array<{ latitude?: number | null; longitude?: number | null; name?: string | null }>;
  attractions?: Array<{ latitude?: number | null; longitude?: number | null; name?: string | null }>;
  itineraries?: Array<{ latitude?: number | null; longitude?: number | null; title?: string | null }>;
}): MapPoint[] {
  const out: MapPoint[] = [];
  const seen = new Set<string>();
  const push = (lat: number | null, lng: number | null, label?: string | null) => {
    if (lat == null || lng == null) return;
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ lat, lng, label: label?.trim() || undefined });
  };

  for (const a of sources.accommodations ?? []) {
    push(toNum(a.latitude), toNum(a.longitude), a.name);
  }
  for (const d of sources.dining ?? []) {
    push(toNum(d.latitude), toNum(d.longitude), d.name);
  }
  for (const a of sources.attractions ?? []) {
    push(toNum(a.latitude), toNum(a.longitude), a.name);
  }
  for (const i of sources.itineraries ?? []) {
    push(toNum(i.latitude), toNum(i.longitude), i.title);
  }
  return out;
}

/**
 * Builds a Static Maps image URL.
 * Requires Maps Static API enabled on the key (often same as NEXT_PUBLIC_GOOGLE_MAP_API_KEY).
 */
export function buildStaticMapUrl(
  points: MapPoint[],
  opts?: { width?: number; height?: number; apiKey?: string | null }
): string | null {
  if (!points.length) return null;
  const apiKey =
    (opts?.apiKey && String(opts.apiKey).trim()) ||
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY : undefined) ||
    '';
  if (!apiKey) return null;

  const width = Math.min(Math.max(opts?.width ?? 640, 200), 640);
  const height = Math.min(Math.max(opts?.height ?? 360, 200), 640);
  const params = new URLSearchParams();
  params.set('size', `${width}x${height}`);
  params.set('scale', '2');
  params.set('maptype', 'roadmap');
  params.set('key', apiKey);

  const limited = points.slice(0, 25);
  for (let i = 0; i < limited.length; i++) {
    const p = limited[i]!;
    const label = String.fromCharCode(65 + (i % 26));
    params.append('markers', `color:0xD88C75|label:${label}|${p.lat},${p.lng}`);
  }

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}
