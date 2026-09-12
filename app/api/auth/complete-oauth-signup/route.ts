import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { isValidLang } from '@/lib/language-fonts';
import { isValidCountryCode } from '@/lib/countries';

export const dynamic = 'force-dynamic';

/**
 * Google OAuth 가입 직후: Bearer 세션으로 본인만 별명·언어·국가를 metadata/profiles에 반영.
 * 기존 이메일 sync-signup-metadata(미인증 전용)와 분리 — 이메일 가입 로직은 변경하지 않음.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: {
    nickname?: unknown;
    language?: unknown;
    country_code?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const nickname = String(body.nickname ?? '').trim();
  const language = body.language;
  const countryCode = String(body.country_code ?? '')
    .trim()
    .toUpperCase();

  if (
    !nickname ||
    nickname.length < 2 ||
    nickname.length > 20 ||
    !isValidLang(language) ||
    !isValidCountryCode(countryCode)
  ) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  try {
    const admin = getSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const email = (user.email ?? '').trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'email_required' }, { status: 400 });
    }

    const priorMeta =
      user.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {};

    const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
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
      console.error('complete-oauth-signup: auth update failed', updateErr);
      return NextResponse.json({ error: 'metadata_update_failed' }, { status: 500 });
    }

    const { error: profileErr } = await admin.from('profiles').upsert(
      {
        id: user.id,
        email,
        nickname,
        preferred_language: language,
        country_code: countryCode,
      },
      { onConflict: 'id' },
    );

    if (profileErr) {
      console.warn('complete-oauth-signup: profiles upsert failed', profileErr);
      return NextResponse.json({ error: 'profile_update_failed' }, { status: 500 });
    }

    try {
      const { enrollUserInAppAsService } = await import('@/lib/app-enrollment');
      await enrollUserInAppAsService({ userId: user.id, source: 'signup' });
    } catch (enrollErr) {
      console.error('complete-oauth-signup: enrollment failed', enrollErr);
      return NextResponse.json(
        {
          error:
            enrollErr instanceof Error && enrollErr.message.includes('signups not allowed')
              ? 'signups_not_allowed'
              : 'enrollment_failed',
        },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('complete-oauth-signup error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
