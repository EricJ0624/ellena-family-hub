/** create_group RPC — 짧은 시간 내 연속 생성 시도 */
export function messageFromGroupCreateRpcError(
  raw: string | null | undefined,
): 'GROUP_CREATE_BURST' | null {
  const text = String(raw || '');
  if (text.includes('GROUP_CREATE_BURST')) return 'GROUP_CREATE_BURST';
  return null;
}
