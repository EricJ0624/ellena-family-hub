/**
 * 클라이언트용 사진 리사이즈/유틸 (memories 페이지 업로드 등)
 */
export function resizeImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          } else {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context를 가져올 수 없습니다.'));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        const isPNG = file.type === 'image/png' || fileExt === 'png';
        const outputFormat = isPNG ? 'image/png' : 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('이미지 압축에 실패했습니다.'));
              return;
            }
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = () => reject(new Error('압축된 이미지 읽기 실패'));
            r.readAsDataURL(blob);
          },
          outputFormat,
          quality
        );
      };
      img.onerror = () => reject(new Error('이미지 로드에 실패했습니다.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsDataURL(file);
  });
}

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  cr2: 'image/x-canon-cr2',
  nef: 'image/x-nikon-nef',
  arw: 'image/x-sony-arw',
  orf: 'image/x-olympus-orf',
  rw2: 'image/x-panasonic-rw2',
  dng: 'image/x-adobe-dng',
  raw: 'image/x-raw',
  raf: 'image/x-fuji-raf',
  srw: 'image/x-samsung-srw',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

export function getMimeTypeFromExtension(extension: string): string | null {
  const ext = extension.toLowerCase();
  return MIME_MAP[ext] || null;
}

/** RAW 확장자 목록 (대시보드와 동일) */
const RAW_EXTENSIONS = [
  'raw', 'cr2', 'nef', 'arw', 'orf', 'rw2', 'dng', 'raf', 'srw',
  '3fr', 'ari', 'bay', 'crw', 'cap', 'data', 'dcs', 'dcr', 'drf',
  'eip', 'erf', 'fff', 'iiq', 'k25', 'kdc', 'mef', 'mos', 'mrw',
  'nrw', 'obm', 'pef', 'ptx', 'pxn', 'r3d', 'rwl', 'rwz', 'sr2',
  'srf', 'tif', 'x3f',
];

export function isRawFileExtension(extension: string): boolean {
  return RAW_EXTENSIONS.includes(extension.toLowerCase());
}

/**
 * 표시용 이미지 데이터 생성 (대시보드와 동일: 500KB 기준 리사이즈, 2MB 초과 시 1280/1024 추가 압축, RAW 지원)
 */
export async function getDisplayImageData(file: File): Promise<string> {
  const RESIZE_THRESHOLD = 500 * 1024; // 500KB
  const MAX_FINAL_SIZE = 2 * 1024 * 1024; // 2MB
  const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
  const isRaw = isRawFileExtension(fileExt);

  let imageData: string;
  if (isRaw) {
    try {
      imageData = await resizeImage(file, 2560, 2560, 0.85);
    } catch {
      imageData = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
    }
  } else if (file.size > RESIZE_THRESHOLD) {
    imageData = await resizeImage(file, 1920, 1920, 0.8);
    const base64Size = (imageData.length * 3) / 4;
    if (base64Size > MAX_FINAL_SIZE) {
      imageData = await resizeImage(file, 1280, 1280, 0.6);
      const nextSize = (imageData.length * 3) / 4;
      if (nextSize > MAX_FINAL_SIZE) {
        imageData = await resizeImage(file, 1024, 1024, 0.5);
      }
    }
  } else {
    const r = new FileReader();
    imageData = await new Promise<string>((res, rej) => {
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
  return imageData;
}
