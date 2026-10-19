import { createSign } from 'crypto';
import { readFileSync } from 'fs';

export type CloudFrontSigner = {
  keyPairId: string;
  privateKeyPem: string;
};

function normalizedPrivateKey(raw: string): string {
  return raw.replace(/\\n/g, '\n').trim();
}

/** 둘 다 있으면 서명하고, 하나만 있으면 설정 오류로 본다. 둘 다 없으면 null. */
export function resolveCloudFrontSigner(): CloudFrontSigner | null | 'incomplete' {
  const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID?.trim() || '';
  const inline = process.env.CLOUDFRONT_PRIVATE_KEY?.trim() || '';
  const file = process.env.CLOUDFRONT_PRIVATE_KEY_FILE?.trim() || '';
  const hasId = keyPairId.length > 0;
  const hasKey = inline.length > 0 || file.length > 0;
  if (!hasId && !hasKey) return null;
  if (!hasId || !hasKey || !/^K[A-Z0-9]+$/.test(keyPairId)) return 'incomplete';

  try {
    const privateKeyPem = inline
      ? normalizedPrivateKey(inline)
      : readFileSync(file, 'utf8').trim();
    if (!privateKeyPem.includes('BEGIN') || !privateKeyPem.includes('PRIVATE KEY')) return 'incomplete';
    return { keyPairId, privateKeyPem };
  } catch {
    return 'incomplete';
  }
}

function cloudFrontSafeBase64(value: string): string {
  return value.replaceAll('+', '-').replaceAll('=', '_').replaceAll('/', '~');
}

/** CloudFront canned policy 서명. 쿼리 없는 객체 주소와 만료 시각을 묶는다. */
export function signCloudFrontUrl(
  unsignedUrl: string,
  expiresEpoch: number,
  keyPairId: string,
  privateKeyPem: string,
): string {
  const expires = Math.floor(expiresEpoch);
  const policy = JSON.stringify({
    Statement: [{
      Resource: unsignedUrl,
      Condition: { DateLessThan: { 'AWS:EpochTime': expires } },
    }],
  });
  const signature = cloudFrontSafeBase64(
    createSign('RSA-SHA1').update(policy).sign(privateKeyPem, 'base64'),
  );
  return `${unsignedUrl}?Expires=${expires}&Signature=${signature}&Key-Pair-Id=${keyPairId}`;
}
