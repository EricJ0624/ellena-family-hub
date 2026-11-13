/**
 * EXIF DateTimeOriginal 파서
 *
 * - 1순위: exifr 패키지 (lazy import — 번들 분리)
 * - 2순위: 직접 JPEG/HEIC APP1 헤더 파싱
 * - 최종 폴백: null 반환 (UI는 created_at을 사용)
 */

/**
 * File 객체에서 촬영 날짜를 추출한다.
 * 반환값이 null이면 호출부는 file.lastModified 혹은 created_at을 사용한다.
 */
export async function extractExifDate(file: File): Promise<Date | null> {
  // exifr는 선택적 의존성 — 미설치 환경에서도 폴백하도록 try/catch
  try {
    // @ts-ignore — exifr 미설치 시 ImportError, 폴백으로 처리
    const exifr = await import('exifr');
    const tags = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate']);
    const raw: Date | string | undefined =
      tags?.DateTimeOriginal ?? tags?.CreateDate;
    if (raw) {
      const d = raw instanceof Date ? raw : new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }
  } catch {
    // exifr 없음 → 직접 파싱 시도
  }

  // 직접 JPEG APP1 파싱
  try {
    const date = await parseJpegExifDate(file);
    if (date) return date;
  } catch {
    // 파싱 실패 → null
  }

  return null;
}

/**
 * JPEG 바이너리에서 직접 DateTimeOriginal 태그를 읽는다.
 * JPEG SOI(FFD8) → APP1(FFE1) → EXIF IFD0 → SubIFD → DateTimeOriginal
 */
async function parseJpegExifDate(file: File): Promise<Date | null> {
  if (!file.type.startsWith('image/jpeg') && !file.type.startsWith('image/jpg')) {
    return null;
  }

  const buffer = await file.slice(0, 65536).arrayBuffer();
  const view = new DataView(buffer);

  // JPEG SOI 확인
  if (view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset < view.byteLength - 2) {
    const marker = view.getUint16(offset);
    if (marker === 0xffe1) {
      // APP1 발견
      const length = view.getUint16(offset + 2);
      const exifStart = offset + 4;
      // "Exif\0\0" 헤더 확인
      if (view.getUint32(exifStart) === 0x45786966 && view.getUint16(exifStart + 4) === 0) {
        const tiffStart = exifStart + 6;
        return parseTiffDateTimeOriginal(view, tiffStart, length - 2);
      }
      offset += 2 + length;
    } else if ((marker & 0xff00) === 0xff00) {
      const length = view.getUint16(offset + 2);
      offset += 2 + length;
    } else {
      break;
    }
  }
  return null;
}

function parseTiffDateTimeOriginal(
  view: DataView,
  tiffStart: number,
  _maxLen: number
): Date | null {
  try {
    const byteOrder = view.getUint16(tiffStart);
    const le = byteOrder === 0x4949; // 'II' = Little Endian
    const getU16 = (off: number) => view.getUint16(tiffStart + off, le);
    const getU32 = (off: number) => view.getUint32(tiffStart + off, le);

    const ifd0Offset = getU32(4);
    const ifd0Count = getU16(ifd0Offset);

    let subIfdOffset: number | null = null;
    for (let i = 0; i < ifd0Count; i++) {
      const entryOffset = ifd0Offset + 2 + i * 12;
      const tag = getU16(entryOffset);
      if (tag === 0x8769) {
        // ExifIFD pointer
        subIfdOffset = getU32(entryOffset + 8);
        break;
      }
    }

    if (subIfdOffset === null) return null;

    const subCount = getU16(subIfdOffset);
    for (let i = 0; i < subCount; i++) {
      const entryOffset = subIfdOffset + 2 + i * 12;
      const tag = getU16(entryOffset);
      if (tag === 0x9003) {
        // DateTimeOriginal — ASCII, len=20, "YYYY:MM:DD HH:MM:SS\0"
        const valOffset = getU32(entryOffset + 8);
        let str = '';
        for (let j = 0; j < 19; j++) {
          str += String.fromCharCode(view.getUint8(tiffStart + valOffset + j));
        }
        // "2023:04:15 10:30:00" → "2023-04-15T10:30:00"
        const iso = str.replace(/^(\d{4}):(\d{2}):(\d{2}) /, '$1-$2-$3T');
        const d = new Date(iso);
        if (!isNaN(d.getTime())) return d;
        return null;
      }
    }
  } catch {
    // 파싱 오류 → null
  }
  return null;
}
