import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { writeAdminAuditLog, getAuditRequestMeta } from '@/lib/admin-audit';
import { DASHBOARD_WIDGET_KEYS, type DashboardWidgetKey } from '@/lib/widgets/types';
import { isValidLang } from '@/lib/language-fonts';

const BUCKET = 'showroom-preview-videos';
const MAX_BYTES = 20 * 1024 * 1024;
const SIGNED_URL_SECONDS = 60 * 10;

const ALLOWED_TYPES = new Map<string, string>([
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm'],
]);

type PreviewRow = {
  id: string;
  widget_key: string;
  lang: string;
  storage_path: string;
  created_at: string;
};

function isWidgetKey(value: string): value is DashboardWidgetKey {
  return (DASHBOARD_WIDGET_KEYS as readonly string[]).includes(value);
}

const VIDEO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extensionFor(file: File): string | null {
  const fromType = ALLOWED_TYPES.get(file.type);
  if (fromType) return fromType;
  if (file.type && file.type !== 'application/octet-stream') return null;
  const name = file.name.toLowerCase();
  if (name.endsWith('.mp4')) return 'mp4';
  if (name.endsWith('.webm')) return 'webm';
  return null;
}

async function ensureBucket(supabase: ReturnType<typeof getSupabaseServerClient>) {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return null;
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: [...ALLOWED_TYPES.keys()],
  });
  return error;
}

async function guard(request: NextRequest) {
  const authResult = await requireAuthUser(request);
  if (authResult instanceof NextResponse) return authResult;
  const adminCheck = await requireSystemAdmin(authResult.user.id);
  if (adminCheck instanceof NextResponse) return adminCheck;
  return authResult.user;
}

export async function GET(request: NextRequest) {
  try {
    const user = await guard(request);
    if (user instanceof NextResponse) return user;

    const supabase = getSupabaseServerClient();
    const bucketError = await ensureBucket(supabase);
    if (bucketError) {
      console.error('쇼룸 미리보기 버킷 오류:', bucketError);
      return NextResponse.json({ error: '미리보기 저장소를 준비하지 못했습니다.' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('showroom_preview_videos')
      .select('id, widget_key, lang, storage_path, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('쇼룸 미리보기 조회 오류:', error);
      return NextResponse.json({ error: '미리보기 영상을 불러오지 못했습니다.' }, { status: 500 });
    }

    const rows = (data ?? []) as PreviewRow[];
    const videos = await Promise.all(
      rows.map(async (row) => {
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(row.storage_path, SIGNED_URL_SECONDS);
        return {
          id: row.id,
          widgetKey: row.widget_key,
          lang: row.lang,
          url: signed?.signedUrl ?? null,
        };
      }),
    );

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('쇼룸 미리보기 조회 실패:', error);
    return NextResponse.json({ error: '미리보기 영상을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await guard(request);
    if (user instanceof NextResponse) return user;

    const form = await request.formData();
    const widgetKey = String(form.get('widgetKey') ?? '');
    const lang = String(form.get('lang') ?? '');
    const file = form.get('file');

    if (!isWidgetKey(widgetKey) || !isValidLang(lang)) {
      return NextResponse.json({ error: '위젯 또는 언어가 올바르지 않습니다.' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '영상 파일이 필요합니다.' }, { status: 400 });
    }
    const extension = extensionFor(file);
    if (!extension) {
      return NextResponse.json({ error: 'mp4 또는 webm 파일만 올릴 수 있습니다.' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: '영상은 20MB 이하만 저장할 수 있습니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const bucketError = await ensureBucket(supabase);
    if (bucketError) {
      console.error('쇼룸 미리보기 버킷 오류:', bucketError);
      return NextResponse.json({ error: '미리보기 저장소를 준비하지 못했습니다.' }, { status: 500 });
    }

    const { data: existing, error: existingError } = await supabase
      .from('showroom_preview_videos')
      .select('id, storage_path')
      .eq('widget_key', widgetKey)
      .eq('lang', lang)
      .maybeSingle();
    if (existingError) {
      console.error('쇼룸 미리보기 조회 오류:', existingError);
      return NextResponse.json({ error: '영상을 저장하지 못했습니다.' }, { status: 500 });
    }

    const storagePath = `${widgetKey}/${lang}/${Date.now()}.${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const contentType = extension === 'webm' ? 'video/webm' : 'video/mp4';
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType,
      upsert: false,
    });
    if (uploadError) {
      console.error('쇼룸 미리보기 업로드 오류:', uploadError);
      return NextResponse.json({ error: '영상을 저장하지 못했습니다.' }, { status: 500 });
    }

    const previous = existing as { id: string; storage_path: string } | null;
    const { error: saveError } = previous
      ? await supabase
          .from('showroom_preview_videos')
          .update({ storage_path: storagePath, created_by: user.id, created_at: new Date().toISOString() })
          .eq('id', previous.id)
      : await supabase.from('showroom_preview_videos').insert({
          widget_key: widgetKey,
          lang,
          storage_path: storagePath,
          created_by: user.id,
        });

    if (saveError) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      console.error('쇼룸 미리보기 기록 오류:', saveError);
      return NextResponse.json({ error: '영상을 저장하지 못했습니다.' }, { status: 500 });
    }

    if (previous?.storage_path && previous.storage_path !== storagePath) {
      await supabase.storage.from(BUCKET).remove([previous.storage_path]);
    }

    const meta = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'showroom_preview_save',
      resourceType: 'showroom_preview_video',
      resourceId: `${widgetKey}:${lang}`,
      details: { widgetKey, lang },
      ...meta,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('쇼룸 미리보기 저장 실패:', error);
    return NextResponse.json({ error: '영상을 저장하지 못했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await guard(request);
    if (user instanceof NextResponse) return user;

    const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!VIDEO_ID.test(id)) {
      return NextResponse.json({ error: '삭제할 영상이 없습니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('showroom_preview_videos')
      .select('id, widget_key, lang, storage_path')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: '삭제할 영상이 없습니다.' }, { status: 404 });
    }

    const row = data as PreviewRow;
    const { error: deleteError } = await supabase.from('showroom_preview_videos').delete().eq('id', id);
    if (deleteError) {
      console.error('쇼룸 미리보기 삭제 오류:', deleteError);
      return NextResponse.json({ error: '영상을 삭제하지 못했습니다.' }, { status: 500 });
    }
    await supabase.storage.from(BUCKET).remove([row.storage_path]);

    const meta = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'showroom_preview_delete',
      resourceType: 'showroom_preview_video',
      resourceId: id,
      details: { widgetKey: row.widget_key, lang: row.lang },
      ...meta,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('쇼룸 미리보기 삭제 실패:', error);
    return NextResponse.json({ error: '영상을 삭제하지 못했습니다.' }, { status: 500 });
  }
}
