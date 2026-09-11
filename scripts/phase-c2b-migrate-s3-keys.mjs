/**
 * Phase C-2b: 레거시 S3 키 originals/groups/… → originals/apps/hearth_family/groups/…
 *
 * 기본: dry-run (복사·DB 변경 없음)
 * 실행: node scripts/phase-c2b-migrate-s3-keys.mjs --execute
 *
 * 레거시 객체 삭제는 하지 않음 (검증 후 수동).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  S3Client,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] == null) process.env[key] = val;
  }
}

const EXECUTE = process.argv.includes('--execute');
const LEGACY_PREFIX = 'originals/groups/';
const NEW_PREFIX = 'originals/apps/hearth_family/groups/';

function toNewKey(legacyKey) {
  if (!legacyKey?.startsWith(LEGACY_PREFIX)) return null;
  return NEW_PREFIX + legacyKey.slice(LEGACY_PREFIX.length);
}

function rewriteUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes(LEGACY_PREFIX)) return url;
  return url.split(LEGACY_PREFIX).join(NEW_PREFIX);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main() {
  const bucket = requireEnv('AWS_S3_BUCKET_NAME');
  const region = process.env.AWS_REGION || 'ap-northeast-2';
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const s3 = new S3Client({
    region,
    credentials: {
      accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
    },
  });

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`[C-2b] mode=${EXECUTE ? 'EXECUTE' : 'DRY-RUN'} bucket=${bucket}`);

  const [albumRes, attByKey, attByThumb, sceneByImage, sceneByVariant] = await Promise.all([
    supabase
      .from('family_album_items')
      .select('id, s3_key, image_url, s3_original_url')
      .like('s3_key', `${LEGACY_PREFIX}%`),
    supabase
      .from('attachments')
      .select('id, s3_key, thumbnail_s3_key, image_url, thumbnail_url')
      .like('s3_key', `${LEGACY_PREFIX}%`),
    supabase
      .from('attachments')
      .select('id, s3_key, thumbnail_s3_key, image_url, thumbnail_url')
      .like('thumbnail_s3_key', `${LEGACY_PREFIX}%`),
    supabase
      .from('picture_find_scenes')
      .select('id, image_s3_key, variant_image_s3_key, image_url, variant_image_url')
      .like('image_s3_key', `${LEGACY_PREFIX}%`),
    supabase
      .from('picture_find_scenes')
      .select('id, image_s3_key, variant_image_s3_key, image_url, variant_image_url')
      .like('variant_image_s3_key', `${LEGACY_PREFIX}%`),
  ]);

  for (const res of [albumRes, attByKey, attByThumb, sceneByImage, sceneByVariant]) {
    if (res.error) throw res.error;
  }

  const album = albumRes.data || [];
  const attMap = new Map();
  for (const row of [...(attByKey.data || []), ...(attByThumb.data || [])]) {
    attMap.set(row.id, row);
  }
  const attachments = [...attMap.values()];
  const sceneMap = new Map();
  for (const row of [...(sceneByImage.data || []), ...(sceneByVariant.data || [])]) {
    sceneMap.set(row.id, row);
  }
  const scenes = [...sceneMap.values()];

  const keySet = new Set();
  for (const row of album || []) if (row.s3_key) keySet.add(row.s3_key);
  for (const row of attachments || []) {
    if (row.s3_key?.startsWith(LEGACY_PREFIX)) keySet.add(row.s3_key);
    if (row.thumbnail_s3_key?.startsWith(LEGACY_PREFIX)) keySet.add(row.thumbnail_s3_key);
  }
  for (const row of scenes || []) {
    if (row.image_s3_key?.startsWith(LEGACY_PREFIX)) keySet.add(row.image_s3_key);
    if (row.variant_image_s3_key?.startsWith(LEGACY_PREFIX)) keySet.add(row.variant_image_s3_key);
  }

  const keys = [...keySet].sort();
  console.log(`[C-2b] unique legacy keys: ${keys.length}`);
  console.log(
    `[C-2b] rows: album=${album.length} attachments=${attachments.length} scenes=${scenes.length}`,
  );

  let copied = 0;
  let already = 0;
  let missing = 0;
  const failed = [];
  const readyKeys = new Set(); // legacy keys that are safe to point DB at new prefix

  for (const legacyKey of keys) {
    const newKey = toNewKey(legacyKey);
    if (!newKey) continue;

    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: legacyKey }));
    } catch {
      missing += 1;
      console.warn(`[C-2b] MISSING source: ${legacyKey}`);
      continue;
    }

    let destExists = false;
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: newKey }));
      destExists = true;
    } catch {
      destExists = false;
    }

    if (destExists) {
      already += 1;
      readyKeys.add(legacyKey);
      continue;
    }

    if (!EXECUTE) {
      console.log(`[C-2b] would copy: ${legacyKey} -> ${newKey}`);
      copied += 1;
      readyKeys.add(legacyKey); // dry-run assumes copy would succeed
      continue;
    }

    try {
      // CopySource: bucket/key — path segments encoded, slashes kept
      const copySource = `${bucket}/${legacyKey
        .split('/')
        .map((seg) => encodeURIComponent(seg))
        .join('/')}`;
      await s3.send(
        new CopyObjectCommand({
          Bucket: bucket,
          CopySource: copySource,
          Key: newKey,
          MetadataDirective: 'COPY',
        }),
      );
      copied += 1;
      readyKeys.add(legacyKey);
      console.log(`[C-2b] copied: ${newKey}`);
    } catch (e) {
      failed.push({ legacyKey, error: String(e?.message || e) });
      console.error(`[C-2b] COPY FAIL ${legacyKey}:`, e?.message || e);
    }
  }

  console.log(`[C-2b] S3 summary: copied/planned=${copied} already=${already} missing=${missing} failed=${failed.length}`);

  if (failed.length) {
    console.error('[C-2b] aborting DB updates due to copy failures');
    process.exit(1);
  }

  if (!EXECUTE) {
    console.log('[C-2b] dry-run only — re-run with --execute to copy + update DB');
    return;
  }

  // DB updates — only when S3 new key is ready
  let albumUpdated = 0;
  for (const row of album) {
    if (!readyKeys.has(row.s3_key)) continue;
    const nextKey = toNewKey(row.s3_key);
    if (!nextKey) continue;
    const { error } = await supabase
      .from('family_album_items')
      .update({
        s3_key: nextKey,
        image_url: rewriteUrl(row.image_url),
        s3_original_url: rewriteUrl(row.s3_original_url),
      })
      .eq('id', row.id)
      .eq('s3_key', row.s3_key);
    if (error) throw error;
    albumUpdated += 1;
  }

  let attUpdated = 0;
  for (const row of attachments) {
    const patch = {};
    if (row.s3_key?.startsWith(LEGACY_PREFIX)) {
      if (!readyKeys.has(row.s3_key)) continue;
      patch.s3_key = toNewKey(row.s3_key);
    }
    if (row.thumbnail_s3_key?.startsWith(LEGACY_PREFIX)) {
      if (!readyKeys.has(row.thumbnail_s3_key)) continue;
      patch.thumbnail_s3_key = toNewKey(row.thumbnail_s3_key);
    }
    if (row.image_url?.includes(LEGACY_PREFIX)) patch.image_url = rewriteUrl(row.image_url);
    if (row.thumbnail_url?.includes(LEGACY_PREFIX)) patch.thumbnail_url = rewriteUrl(row.thumbnail_url);
    if (!Object.keys(patch).length) continue;
    const { error } = await supabase.from('attachments').update(patch).eq('id', row.id);
    if (error) throw error;
    attUpdated += 1;
  }

  let sceneUpdated = 0;
  for (const row of scenes) {
    const patch = {};
    if (row.image_s3_key?.startsWith(LEGACY_PREFIX)) {
      if (!readyKeys.has(row.image_s3_key)) continue;
      patch.image_s3_key = toNewKey(row.image_s3_key);
    }
    if (row.variant_image_s3_key?.startsWith(LEGACY_PREFIX)) {
      if (!readyKeys.has(row.variant_image_s3_key)) continue;
      patch.variant_image_s3_key = toNewKey(row.variant_image_s3_key);
    }
    if (row.image_url?.includes(LEGACY_PREFIX)) patch.image_url = rewriteUrl(row.image_url);
    if (row.variant_image_url?.includes(LEGACY_PREFIX)) {
      patch.variant_image_url = rewriteUrl(row.variant_image_url);
    }
    if (!Object.keys(patch).length) continue;
    const { error } = await supabase.from('picture_find_scenes').update(patch).eq('id', row.id);
    if (error) throw error;
    sceneUpdated += 1;
  }

  console.log(
    `[C-2b] DB updated: album=${albumUpdated} attachments=${attUpdated} scenes=${sceneUpdated}`,
  );
  console.log('[C-2b] done. Legacy S3 objects NOT deleted — verify album/chat/attachments, then delete manually if desired.');
}

main().catch((e) => {
  console.error('[C-2b] fatal:', e);
  process.exit(1);
});
