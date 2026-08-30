import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { isValidLang } from '@/lib/language-fonts';
import { isValidCountryCode } from '@/lib/countries';

export const dynamic = 'force-dynamic';

/** signUp 직후·미인증 재가입 시 metadata·profiles 동기화 (service role) */
export async function POST(request: NextRequest) {
  let body: {
    user_id?: unknown;
    email?: unknown;
    language?: unknown;
    nickname?: unknown;
    country_code?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const userId = String(body.user_id ?? '').trim();
  const email = String(body.email ?? '')
    .trim()
    .toLowerCase();
  const nickname = String(body.nickname ?? '').trim();
  const language = body.language;
  const countryCode = String(body.country_code ?? '').trim().toUpperCase();

  if (
    !userId ||
    !email ||
    !nickname ||
    !isValidLang(language) ||
    !isValidCountryCode(countryCode)
  ) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  try {
    const admin = getSupabaseServerClient();
    const { data: userData, error: getErr } = await admin.auth.admin.getUserById(userId);

    if (getErr || !userData?.user) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }

    const user = userData.user;
    if ((user.email ?? '').toLowerCase() !== email) {
      return NextResponse.json({ error: 'email_mismatch' }, { status: 403 });
    }

    if (user.email_confirmed_at) {
      return NextResponse.json(
        { ok: true, skipped: 'already_confirmed' },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const priorMeta =
      user.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {};

    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...priorMeta,
        nickname,
        full_name: nickname,
        language,
        preferred_language: language,
        country_code: countryCode,
      },
    });

    if (updateErr) {
      console.error('sync-signup-metadata: auth update failed', updateErr);
      return NextResponse.json({ error: 'metadata_update_failed' }, { status: 500 });
    }

    const { error: profileErr } = await admin.from('profiles').upsert(
      {
        id: userId,
        email,
        nickname,
        preferred_language: language,
        country_code: countryCode,
      },
      { onConflict: 'id' },
    );

    if (profileErr) {
      console.warn('sync-signup-metadata: profiles upsert failed', profileErr);
    }

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('sync-signup-metadata error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
