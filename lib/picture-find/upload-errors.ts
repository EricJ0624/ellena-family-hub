/** Safari/iOS 등에서 fetch 실패 시 흔한 TypeError 메시지를 사용자용으로 변환 */
export function mapPictureFindUploadError(error: unknown, fallback: string): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : fallback;

  if (/load failed|failed to fetch|networkerror|network request failed|abort/i.test(message)) {
    return '사진 업로드에 실패했습니다. 네트워크를 확인하거나 JPEG/PNG로 다시 시도해 주세요.';
  }
  if (/heic|heif/i.test(message) && /unsupported|fail|canvas/i.test(message)) {
    return '이 기기에서 HEIC를 변환하지 못했습니다. JPEG/PNG로 저장 후 올려 주세요.';
  }
  if (/인증|session|unauthorized|401/i.test(message)) {
    return '로그인이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.';
  }
  return message || fallback;
}
