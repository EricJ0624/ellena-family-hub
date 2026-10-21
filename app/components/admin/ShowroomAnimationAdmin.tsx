'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clapperboard, Loader2, Trash2, Upload } from 'lucide-react';
import { WidgetShowroomDemoOverlay } from '@/app/components/dashboard/WidgetShowroomDemoOverlay';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import { LANG_OPTIONS, type LangCode } from '@/lib/language-fonts';
import { DASHBOARD_WIDGET_KEYS, type DashboardWidgetKey } from '@/lib/widgets/types';
import { showroomWidgetLabels } from '@/lib/widgets/showroom-widget-labels';

type SavedVideo = {
  id: string;
  widgetKey: DashboardWidgetKey;
  lang: LangCode;
  url: string | null;
};

type PlayMode = 'built-in' | 'file';

const COPY = {
  ko: {
    title: '쇼룸 애니메이션',
    body: '언어를 고르면 지금 연출과 직접 올린 영상을 비교할 수 있습니다. 체크한 언어만 가족 쇼룸 재생이 바뀌고, 이 화면은 대시보드로 이동하지 않습니다.',
    lang: '확인할 언어',
    builtin: '지금 연출 보기',
    watch: '올린 영상 보기',
    upload: '영상 저장',
    replace: '영상 교체',
    remove: '영상 삭제',
    empty: '이 언어에는 올린 영상이 없습니다.',
    saved: '영상이 저장되어 있습니다.',
    back: '관리자 페이지로',
    loading: '불러오는 중…',
    session: '로그인 세션이 없습니다. 다시 로그인한 뒤 열어 주세요.',
    loadFailed: '영상을 불러오지 못했습니다.',
    saveFailed: '영상을 저장하지 못했습니다.',
    deleteFailed: '영상을 삭제하지 못했습니다.',
    fallback: '한국어·영어 외 언어의 지금 연출 문구는 영어로 보입니다.',
    fileHint: 'mp4 또는 webm, 20MB 이하. 시작부터 끝까지 한 파일입니다.',
    publish: '이 언어 사용자에게 이 언어 연출을 보여 주기',
    publishHint: '영상이 있으면 영상을, 코드 연출이 있으면 연출을, 둘 다 없으면 영어 영상 또는 영어 연출을 보여 줍니다.',
    koreanAlways: '한국어 사용자는 항상 한국어 연출을 봅니다.',
    publishFailed: '언어 공개 설정을 저장하지 못했습니다.',
  },
  en: {
    title: 'Showroom animations',
    body: 'Pick a language to compare the current animation with an uploaded video. Only a checked language changes family showroom playback. This screen does not open a dashboard.',
    lang: 'Language',
    builtin: 'Play current animation',
    watch: 'Play uploaded video',
    upload: 'Save video',
    replace: 'Replace video',
    remove: 'Delete video',
    empty: 'No uploaded video for this language.',
    saved: 'A video is saved.',
    back: 'Back to admin',
    loading: 'Loading…',
    session: 'Your session expired. Sign in again, then reopen this tab.',
    loadFailed: 'Could not load videos.',
    saveFailed: 'Could not save the video.',
    deleteFailed: 'Could not delete the video.',
    fallback: 'Current animations for languages other than Korean and English use English copy.',
    fileHint: 'One mp4 or webm file, up to 20MB, from start to finish.',
    publish: 'Show this language to people using it',
    publishHint: 'Uses that language’s video, then its animation, then an English video or the English animation.',
    koreanAlways: 'Korean users always see the Korean animation.',
    publishFailed: 'Could not save the language setting.',
  },
} as const;

/**
 * 시스템 관리자 전용 쇼룸 비교.
 * 가족 쇼룸 저장, 위젯 배치, 대시보드 입장은 호출하지 않는다.
 */
export function ShowroomAnimationAdmin({ adminLang }: { adminLang: LangCode }) {
  const text = adminLang === 'ko' ? COPY.ko : COPY.en;
  const [previewLang, setPreviewLang] = useState<LangCode>(adminLang);
  const labels = useMemo(() => showroomWidgetLabels(previewLang), [previewLang]);
  const [videos, setVideos] = useState<SavedVideo[]>([]);
  const [publishedLangs, setPublishedLangs] = useState<LangCode[]>([]);
  const publishedLangsRef = useRef<LangCode[]>([]);
  const publishingRef = useRef(false);
  publishedLangsRef.current = publishedLangs;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [playing, setPlaying] = useState<{ key: DashboardWidgetKey; mode: PlayMode } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await waitForSupabaseSession(supabase);
      if (!session?.access_token) {
        setError(text.session);
        return;
      }
      const response = await fetch('/api/admin/showroom-previews', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = (await response.json().catch(() => ({}))) as {
        videos?: SavedVideo[];
        publishedLangs?: LangCode[];
        error?: string;
      };
      if (!response.ok) {
        setError(result.error ?? text.loadFailed);
        setVideos([]);
        setPublishedLangs([]);
      } else {
        setVideos(Array.isArray(result.videos) ? result.videos : []);
        setPublishedLangs(
          Array.isArray(result.publishedLangs)
            ? result.publishedLangs.filter((code) => code !== 'ko')
            : [],
        );
      }
    } catch {
      setError(text.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [text.session, text.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const byWidget = useMemo(() => {
    const map = new Map<DashboardWidgetKey, SavedVideo>();
    for (const video of videos) {
      if (video.lang !== previewLang || map.has(video.widgetKey)) continue;
      map.set(video.widgetKey, video);
    }
    return map;
  }, [videos, previewLang]);

  const authHeader = async () => {
    const session = await waitForSupabaseSession(supabase);
    if (!session?.access_token) return null;
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const setLanguagePublished = async (lang: LangCode, published: boolean) => {
    if (lang === 'ko' || publishingRef.current) return;
    publishingRef.current = true;
    setError(null);
    setPublishing(true);
    const previous = publishedLangsRef.current;
    setPublishedLangs(
      published
        ? previous.includes(lang)
          ? previous
          : [...previous, lang]
        : previous.filter((code) => code !== lang),
    );
    try {
      const headers = await authHeader();
      if (!headers) {
        setPublishedLangs(previous);
        setError(text.session);
        return;
      }
      const response = await fetch('/api/admin/showroom-previews', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, published }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setPublishedLangs(previous);
        setError(result.error ?? text.publishFailed);
      }
    } catch {
      setPublishedLangs(previous);
      setError(text.publishFailed);
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  };

  const saveFile = async (key: DashboardWidgetKey, file: File) => {
    setBusyKey(key);
    setError(null);
    try {
      const headers = await authHeader();
      if (!headers) {
        setError(text.session);
        return;
      }
      const body = new FormData();
      body.set('widgetKey', key);
      body.set('lang', previewLang);
      body.set('file', file);
      const response = await fetch('/api/admin/showroom-previews', { method: 'POST', headers, body });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? text.saveFailed);
        return;
      }
      await load();
    } catch {
      setError(text.saveFailed);
    } finally {
      setBusyKey(null);
    }
  };

  const removeFile = async (video: SavedVideo) => {
    setBusyKey(video.widgetKey);
    setError(null);
    try {
      const headers = await authHeader();
      if (!headers) {
        setError(text.session);
        return;
      }
      const response = await fetch('/api/admin/showroom-previews', {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: video.id }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? text.deleteFailed);
        return;
      }
      if (playing?.key === video.widgetKey && playing.mode === 'file') setPlaying(null);
      await load();
    } catch {
      setError(text.deleteFailed);
    } finally {
      setBusyKey(null);
    }
  };

  const playingVideo = playing ? byWidget.get(playing.key) : undefined;

  return (
    <div>
      <h2 className="m-0 text-xl font-semibold text-slate-800">{text.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{text.body}</p>
      <p className="mt-1 text-xs text-slate-500">{text.fallback}</p>
      <p className="mt-1 text-xs text-slate-400">{text.fileHint}</p>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="flex max-w-xs flex-col gap-1 text-sm font-medium text-slate-700">
          {text.lang}
          <select
            value={previewLang}
            onChange={(event) => setPreviewLang(event.target.value as LangCode)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {LANG_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {previewLang === 'ko' ? (
          <p className="mb-2 text-sm text-slate-600">{text.koreanAlways}</p>
        ) : (
          <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={publishedLangs.includes(previewLang)}
              disabled={publishing}
              onChange={(event) => void setLanguagePublished(previewLang, event.target.checked)}
              className="h-4 w-4 accent-violet-600"
            />
            {text.publish}
          </label>
        )}
        {previewLang === 'ko' ? null : (
          <p className="mb-2 max-w-xl text-xs text-slate-500">{text.publishHint}</p>
        )}
      </div>

      {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {text.loading}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {DASHBOARD_WIDGET_KEYS.map((key) => {
          const saved = byWidget.get(key);
          const busy = busyKey === key;
          return (
            <section key={key} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="m-0 text-base font-semibold text-slate-900">{labels[key]}</h3>
              <p className="mt-1 text-xs text-slate-500">{saved ? text.saved : text.empty}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPlaying({ key, mode: 'built-in' })}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                >
                  {text.builtin}
                </button>
                <button
                  type="button"
                  disabled={!saved?.url}
                  onClick={() => setPlaying({ key, mode: 'file' })}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
                >
                  <Clapperboard className="h-4 w-4" aria-hidden />
                  {text.watch}
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-violet-300 px-3 py-2 text-sm font-semibold text-violet-700">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
                  {saved ? text.replace : text.upload}
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    className="sr-only"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) void saveFile(key, file);
                    }}
                  />
                </label>
                {saved ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeFile(saved)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    {text.remove}
                  </button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {playing?.mode === 'built-in' ? (
        <WidgetShowroomDemoOverlay
          lang={previewLang}
          widgetKey={playing.key}
          widgetLabel={labels[playing.key]}
          closeLabel={text.back}
          onClose={() => setPlaying(null)}
        />
      ) : null}

      {playing?.mode === 'file' && playingVideo?.url ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/70 p-3">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="m-0 text-base font-bold text-slate-900">{labels[playing.key]}</h2>
            </div>
            <div className="bg-slate-950 p-3">
              <video key={playingVideo.url} src={playingVideo.url} controls className="max-h-[60vh] w-full" />
            </div>
            <div className="p-4">
              <button
                type="button"
                onClick={() => setPlaying(null)}
                className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white"
              >
                {text.back}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
