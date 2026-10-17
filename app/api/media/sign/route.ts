import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { issueMediaFileUrl, keyMatchesGroup, s3KeyFromPublicUrl } from '@/lib/media-access-token';

const MAX_URLS = 100;

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json().catch(() => ({}));
    const groupId = String(body?.groupId || '').trim();
    const urls = Array.isArray(body?.urls) ? body.urls.map((url: unknown) => String(url)) : [];
    if (!groupId || urls.length === 0) {
      return NextResponse.json({ error: 'groupId와 urls가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const signed: Record<string, string> = {};
    for (const url of urls.slice(0, MAX_URLS)) {
      const s3Key = s3KeyFromPublicUrl(url);
      if (!s3Key || !keyMatchesGroup(s3Key, groupId)) continue;
      signed[url] = issueMediaFileUrl(s3Key);
    }

    return NextResponse.json({ success: true, urls: signed });
  } catch (error) {
    const message = error instanceof Error ? error.message : '주소 발급 중 오류가 발생했습니다.';
    console.error('미디어 주소 발급 오류:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
