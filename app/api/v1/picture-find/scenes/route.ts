import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { mapSceneRow, PICTURE_FIND_SCENE_SELECT } from '@/lib/picture-find/scene-mapper';
import { getGroupStorageStats } from '@/lib/storage-quota';

const MAX_TITLE = 80;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

/**
 * 활성 장면 목록 (시스템 기본 + 요청 그룹 장면)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;

    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId) {
      return NextResponse.json({ error: 'groupId는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(authResult.user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();

    const { data: systemRows, error: systemError } = await supabase
      .from('picture_find_scenes')
      .select(PICTURE_FIND_SCENE_SELECT)
      .eq('scope', 'system')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (systemError) {
      if (systemError.code === '42P01') {
        return NextResponse.json({ success: true, data: [], fallback: true });
      }
      console.error('[picture-find/scenes] system query error:', systemError);
      return NextResponse.json({ error: '장면 목록 조회에 실패했습니다.' }, { status: 500 });
    }

    const { data: groupRows, error: groupError } = await supabase
      .from('picture_find_scenes')
      .select(PICTURE_FIND_SCENE_SELECT)
      .eq('scope', 'group')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (groupError && groupError.code !== '42P01') {
      console.error('[picture-find/scenes] group query error:', groupError);
      return NextResponse.json({ error: '장면 목록 조회에 실패했습니다.' }, { status: 500 });
    }

    const scenes = [...(systemRows ?? []), ...(groupRows ?? [])].map(mapSceneRow);

    return NextResponse.json({
      success: true,
      data: scenes,
      fallback: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '장면 목록 조회 중 오류가 발생했습니다.';
    console.error('[picture-find/scenes]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Create a group-scoped picture-find scene after client S3 upload.
 * Members may upload; storage quota is enforced here.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const {
      groupId,
      title,
      imageUrl,
      imageS3Key,
      imageSizeBytes,
      variantImageUrl,
      variantImageS3Key,
      variantImageSizeBytes,
      diffMode,
    } = body ?? {};

    if (!groupId || !imageUrl || !imageS3Key) {
      return NextResponse.json({ error: 'groupId, imageUrl, imageS3Key는 필수입니다.' }, { status: 400 });
    }

    const mode = diffMode === 'manual' ? 'manual' : 'auto';
    if (mode === 'manual' && (!variantImageUrl || !variantImageS3Key)) {
      return NextResponse.json(
        { error: '수동(틀린그림 쌍) 모드에서는 비교 이미지가 필요합니다.' },
        { status: 400 },
      );
    }

    const sizeMain = typeof imageSizeBytes === 'number' ? imageSizeBytes : Number(imageSizeBytes);
    const sizeVariant =
      typeof variantImageSizeBytes === 'number'
        ? variantImageSizeBytes
        : Number(variantImageSizeBytes || 0);

    if (!Number.isFinite(sizeMain) || sizeMain <= 0 || sizeMain > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '원본 이미지 크기가 올바르지 않습니다.' }, { status: 400 });
    }
    if (mode === 'manual' && (!Number.isFinite(sizeVariant) || sizeVariant <= 0 || sizeVariant > MAX_FILE_SIZE)) {
      return NextResponse.json({ error: '비교 이미지 크기가 올바르지 않습니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, String(groupId));
    if (memberCheck instanceof NextResponse) return memberCheck;

    const incoming = sizeMain + (mode === 'manual' ? sizeVariant : 0);
    const { quotaBytes, usedBytes } = await getGroupStorageStats(String(groupId));
    if (usedBytes + incoming > quotaBytes) {
      return NextResponse.json(
        {
          error: '그룹 저장 용량을 초과했습니다.',
          details: `현재 사용량 ${(usedBytes / 1024 / 1024 / 1024).toFixed(2)}GB / 한도 ${(quotaBytes / 1024 / 1024 / 1024).toFixed(2)}GB`,
        },
        { status: 413 },
      );
    }

    const safeTitle = String(title || '우리 가족 사진').trim().slice(0, MAX_TITLE) || '우리 가족 사진';
    const supabase = getSupabaseServerClient();

    const { data: maxOrderRow } = await supabase
      .from('picture_find_scenes')
      .select('sort_order')
      .eq('scope', 'group')
      .eq('group_id', String(groupId))
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (maxOrderRow?.sort_order ?? 100) + 1;

    const { data, error } = await supabase
      .from('picture_find_scenes')
      .insert({
        scope: 'group',
        group_id: String(groupId),
        title: safeTitle,
        image_url: String(imageUrl),
        image_s3_key: String(imageS3Key),
        image_size_bytes: sizeMain,
        variant_image_url: mode === 'manual' ? String(variantImageUrl) : null,
        variant_image_s3_key: mode === 'manual' ? String(variantImageS3Key) : null,
        variant_image_size_bytes: mode === 'manual' ? sizeVariant : 0,
        diff_mode: mode,
        supports_hidden: true,
        supports_spot_diff: true,
        sort_order: nextOrder,
        is_active: true,
        created_by: user.id,
      })
      .select(PICTURE_FIND_SCENE_SELECT)
      .single();

    if (error || !data) {
      console.error('[picture-find/scenes] insert error:', error);
      return NextResponse.json({ error: '장면 저장에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: mapSceneRow(data) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '장면 저장 중 오류가 발생했습니다.';
    console.error('[picture-find/scenes] POST', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
