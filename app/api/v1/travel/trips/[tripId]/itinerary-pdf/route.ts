import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { buildExpandedPlannerItinerary } from '@/lib/modules/travel-planner/itinerary-display-expand';
import { buildItineraryDocumentHtml } from '@/lib/modules/travel-planner/itinerary-document-html';
import { renderHtmlToPdfBuffer } from '@/lib/modules/travel-planner/render-itinerary-pdf';
import { buildStaticMapUrl, collectTripMapPoints } from '@/lib/modules/travel-planner/static-map-url';
import { getTravelTranslation } from '@/lib/translations/travel';
import type { LangCode } from '@/lib/language-fonts';
import { DB_TABLES } from '@/lib/db-table-names';
import type {
  TravelAccommodation,
  TravelAttraction,
  TravelDining,
  TravelItinerary,
  TravelTransport,
  TravelTrip,
  TravelDayTitle,
} from '@/lib/modules/travel-planner/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** POST: HTML 일정표 → PDF (Vercel Chromium / 로컬 Chrome) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { tripId } = await params;
    const groupId = request.nextUrl.searchParams.get('groupId');

    if (!groupId || !tripId) {
      return NextResponse.json({ error: 'groupId와 tripId가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data: trip, error: tripErr } = await supabase
      .from('travel_trips')
      .select('*')
      .eq('id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .single();

    if (tripErr || !trip) {
      return NextResponse.json({ error: '여행을 찾을 수 없습니다.' }, { status: 404 });
    }

    const [
      itinerariesRes,
      accommodationsRes,
      diningRes,
      attractionsRes,
      transportsRes,
      dayTitlesRes,
      coverAttRes,
    ] = await Promise.all([
      supabase
        .from('travel_itineraries')
        .select('*')
        .eq('trip_id', tripId)
        .eq('group_id', groupId)
        .is('deleted_at', null),
      supabase
        .from('travel_accommodations')
        .select('*')
        .eq('trip_id', tripId)
        .eq('group_id', groupId)
        .is('deleted_at', null),
      supabase
        .from('travel_dining')
        .select('*')
        .eq('trip_id', tripId)
        .eq('group_id', groupId)
        .is('deleted_at', null),
      supabase
        .from('travel_attractions')
        .select('*')
        .eq('trip_id', tripId)
        .eq('group_id', groupId)
        .is('deleted_at', null),
      supabase
        .from('travel_transports')
        .select('*')
        .eq('trip_id', tripId)
        .eq('group_id', groupId)
        .is('deleted_at', null),
      supabase
        .from('travel_day_titles')
        .select('*')
        .eq('trip_id', tripId)
        .eq('group_id', groupId)
        .is('deleted_at', null),
      supabase
        .from(DB_TABLES.ATTACHMENTS)
        .select('image_url, thumbnail_url, created_at')
        .eq('group_id', groupId)
        .eq('entity_type', 'travel_trip')
        .eq('entity_id', tripId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(1),
    ]);

    const itineraries = (itinerariesRes.data ?? []) as TravelItinerary[];
    const accommodations = (accommodationsRes.data ?? []) as TravelAccommodation[];
    const dining = (diningRes.data ?? []) as TravelDining[];
    const attractions = (attractionsRes.data ?? []) as TravelAttraction[];
    const transports = (transportsRes.data ?? []) as TravelTransport[];
    const dayTitleRows = (dayTitlesRes.data ?? []) as TravelDayTitle[];
    const coverRow = (coverAttRes.data ?? [])[0] as
      | { image_url?: string | null; thumbnail_url?: string | null }
      | undefined;
    const coverImageUrl = (coverRow?.image_url || coverRow?.thumbnail_url || '').trim() || null;
    const mapImageUrl = buildStaticMapUrl(
      collectTripMapPoints({ accommodations, dining, attractions, itineraries }),
    );

    const expanded = buildExpandedPlannerItinerary({
      trip_start_date: (trip as TravelTrip).start_date,
      trip_end_date: (trip as TravelTrip).end_date,
      itineraries,
      accommodations,
      dining,
      attractions,
      transports,
    });

    const dayTitles: Record<string, string> = {};
    for (const row of dayTitleRows) {
      if (row.day_date) dayTitles[row.day_date] = row.title ?? '';
    }

    const { data: memberships } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('group_id', groupId);
    const memberIds = [...new Set((memberships ?? []).map((m) => m.user_id as string))];

    const { data: participantRows } = await supabase
      .from('travel_trip_participants')
      .select('user_id')
      .eq('trip_id', tripId)
      .eq('group_id', groupId)
      .is('deleted_at', null);
    const participantIds = [...new Set((participantRows ?? []).map((p) => p.user_id as string))].filter(
      (id) => memberIds.includes(id),
    );

    let travelerNames: string[] = [];
    let travelerNationalities: string[] = [];
    if (participantIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nickname, email, country_code')
        .in('id', participantIds);
      const byId = new Map(
        (profiles ?? []).map((p) => {
          const nick = p.nickname && String(p.nickname).trim();
          return [p.id as string, nick || p.email || '멤버'] as const;
        }),
      );
      const countryById = new Map(
        (profiles ?? []).map((p) => {
          const cc = String(p.country_code ?? '')
            .trim()
            .toUpperCase();
          return [p.id as string, /^[A-Z]{2}$/.test(cc) ? cc : 'KR'] as const;
        }),
      );
      travelerNames = participantIds.map((id) => byId.get(id) || '멤버');
      travelerNationalities = participantIds.map((id) => countryById.get(id) || 'KR');
    }

    const lang: LangCode = 'ko';
    const html = buildItineraryDocumentHtml({
      trip: trip as TravelTrip,
      items: expanded.map((r) => ({
        type: r.type,
        day_date: r.display_day,
        start_time: r.start_time,
        end_time: r.end_time,
        title: r.title,
        description: r.description,
        address: r.address,
      })),
      accommodations,
      transports,
      dayTitles,
      travelerNames,
      travelerNationalities,
      coverImageUrl,
      mapImageUrl,
      labels: {
        overviewKo: getTravelTranslation(lang, 'doc_overview_ko'),
        overviewEn: getTravelTranslation(lang, 'doc_overview_en'),
        detailsKo: getTravelTranslation(lang, 'doc_details_ko'),
        detailsEn: getTravelTranslation(lang, 'doc_details_en'),
      },
    });

    const pdf = await renderHtmlToPdfBuffer(html);
    const filename = `itinerary-${String((trip as TravelTrip).title || 'trip')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .slice(0, 60)}.pdf`;

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('POST itinerary-pdf:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
