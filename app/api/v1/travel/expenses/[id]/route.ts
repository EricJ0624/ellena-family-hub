import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

/** PATCH: 경비 수정 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const groupId = (body.groupId ?? request.nextUrl.searchParams.get('groupId')) as string | undefined;
    if (!groupId || !id) {
      return NextResponse.json({ error: 'groupId와 id가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();

    const { data: existingExp, error: expFetchError } = await supabase
      .from('travel_expenses')
      .select('trip_id')
      .eq('id', id)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .single();

    if (expFetchError || !existingExp) {
      return NextResponse.json({ error: '경비 항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: tripRow } = await supabase
      .from('travel_trips')
      .select('currency')
      .eq('id', (existingExp as { trip_id: string }).trip_id)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .single();

    const tripCurrency =
      String((tripRow as { currency?: string } | null)?.currency || 'KRW')
        .trim()
        .toUpperCase() || 'KRW';

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
      currency: tripCurrency,
    };
    if (body.category !== undefined) updatePayload.category = body.category ? String(body.category).trim() : null;
    if (body.entry_type !== undefined) updatePayload.entry_type = body.entry_type === 'addition' ? 'addition' : 'expense';
    if (body.amount !== undefined) updatePayload.amount = Number(body.amount);
    if (body.paid_by !== undefined) updatePayload.paid_by = body.paid_by || null;
    if (body.memo !== undefined) updatePayload.memo = body.memo ? String(body.memo).trim() : null;
    if (body.expense_date !== undefined) updatePayload.expense_date = body.expense_date;

    const sourceKinds = new Set(['attraction', 'dining', 'accommodation', 'transport', 'itinerary']);
    if (body.source_kind !== undefined) {
      const sk = body.source_kind == null ? null : String(body.source_kind).trim();
      if (sk !== null && !sourceKinds.has(sk)) {
        return NextResponse.json({ error: '유효하지 않은 source_kind입니다.' }, { status: 400 });
      }
      updatePayload.source_kind = sk;
    }
    if (body.source_id !== undefined) {
      updatePayload.source_id = body.source_id || null;
    }
    if (body.diary_origin !== undefined) {
      updatePayload.diary_origin = Boolean(body.diary_origin);
    }

    const { data, error } = await supabase
      .from('travel_expenses')
      .update(updatePayload)
      .eq('id', id)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('travel_expenses PATCH:', error);
      return NextResponse.json({ error: '경비 수정에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('PATCH /api/v1/travel/expenses/[id]:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}

/** DELETE: 경비 삭제 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id } = await params;
    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId || !id) {
      return NextResponse.json({ error: 'groupId와 id가 필요합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('travel_expenses')
      .update({ deleted_at: now, deleted_by: user.id })
      .eq('id', id)
      .eq('group_id', groupId);

    if (error) {
      console.error('travel_expenses DELETE:', error);
      return NextResponse.json({ error: '경비 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE /api/v1/travel/expenses/[id]:', e);
    return NextResponse.json({ error: e.message ?? '서버 오류' }, { status: 500 });
  }
}
