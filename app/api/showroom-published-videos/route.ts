import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser } from '@/lib/api-guards';
import { isValidLang, type LangCode } from '@/lib/language-fonts';
import { hasNativeShowroomCopy } from '@/lib/translations/widgetShowroom';
import { DASHBOARD_WIDGET_KEYS, type DashboardWidgetKey } from '@/lib/widgets/types';

const BUCKET = 'showroom-preview-videos';
const SIGNED_URL_SECONDS = 60 * 10;

type VideoRow = { widget_key: string; lang: string; storage_path: string };
type SignedVideo = { widgetKey: DashboardWidgetKey; url: string };

function isWidgetKey(value: string): value is DashboardWidgetKey {
  return (DASHBOARD_WIDGET_KEYS as readonly string[]).includes(value);
}

async function signedVideos(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  rows: VideoRow[],
  lang: LangCode,
): Promise<SignedVideo[]> {
  const signed = await Promise.all(
    rows
      .filter((row) => row.lang === lang && isWidgetKey(row.widget_key))
      .map(async (row) => {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, SIGNED_URL_SECONDS);
        if (!data?.signedUrl) return null;
        return { widgetKey: row.widget_key as DashboardWidgetKey, url: data.signedUrl };
      }),
  );
  return signed.filter((video): video is SignedVideo => video !== null);
}

/**
 * 공개된 언어의 쇼룸 영상만 돌려준다.
 * 그 언어 영상이 없고 코드 연출도 없으면 영어 영상을 함께 준다.
 * 쇼룸 완료, 위젯 저장, 대시보드 입장과는 연결하지 않는다.
 * 한국어는 항상 코드 연출이므로 영상을 내려주지 않는다.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;

    const lang = request.nextUrl.searchParams.get('lang') ?? '';
    if (!isValidLang(lang) || lang === 'ko') {
      return NextResponse.json({ videos: [] });
    }

    const supabase = getSupabaseServerClient();
    const { data: publication, error: publicationError } = await supabase
      .from('showroom_preview_lang_publications')
      .select('published')
      .eq('lang', lang)
      .maybeSingle();
    if (publicationError || publication?.published !== true) {
      return NextResponse.json({ videos: [] });
    }

    const nativeCopy = hasNativeShowroomCopy(lang);
    const langs = nativeCopy ? [lang] : [lang, 'en'];
    const { data, error } = await supabase
      .from('showroom_preview_videos')
      .select('widget_key, lang, storage_path')
      .in('lang', langs);
    if (error || !data) {
      return NextResponse.json({ videos: [], fallbackVideos: [], nativeCopy });
    }

    const rows = data as VideoRow[];
    const videos = await signedVideos(supabase, rows, lang);
    const fallbackVideos = nativeCopy ? [] : await signedVideos(supabase, rows, 'en');

    return NextResponse.json({ videos, fallbackVideos, nativeCopy });
  } catch (error) {
    console.error('공개 쇼룸 영상 조회 실패:', error);
    return NextResponse.json({ videos: [] });
  }
}
