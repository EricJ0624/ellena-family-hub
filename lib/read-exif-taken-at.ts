/** 원본 파일의 촬영일. 없으면 null. */
export async function readExifTakenAt(file: Blob): Promise<string | null> {
  try {
    const exifr = await import('exifr');
    const parse = exifr.parse ?? exifr.default?.parse;
    if (!parse) return null;
    const exif = await parse(file, {
      pick: ['DateTimeOriginal', 'DateTime', 'CreateDate'],
    });
    const value = exif?.DateTimeOriginal || exif?.DateTime || exif?.CreateDate;
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.log('EXIF 읽기 실패:', error);
    }
    return null;
  }
}
