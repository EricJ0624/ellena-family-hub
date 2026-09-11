/**
 * Phase C-2b cleanup: delete legacy S3 keys under originals/groups/
 * only when twin exists at originals/apps/hearth_family/groups/…
 *
 * Dry-run: node scripts/phase-c2b-delete-legacy-s3.mjs
 * Execute: node scripts/phase-c2b-delete-legacy-s3.mjs --execute
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

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
/** DB에 없는 orphan 레거시도 삭제 (twins 없는 originals/groups/…) */
const INCLUDE_ORPHANS = process.argv.includes('--include-orphans');
const LEGACY_PREFIX = 'originals/groups/';
const NEW_PREFIX = 'originals/apps/hearth_family/groups/';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function toNewKey(legacyKey) {
  if (!legacyKey.startsWith(LEGACY_PREFIX)) return null;
  return NEW_PREFIX + legacyKey.slice(LEGACY_PREFIX.length);
}

async function listLegacyKeys(s3, bucket) {
  const keys = [];
  let token;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: LEGACY_PREFIX,
        ContinuationToken: token,
      }),
    );
    for (const obj of res.Contents || []) {
      if (obj.Key && !obj.Key.endsWith('/')) keys.push(obj.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function main() {
  const bucket = requireEnv('AWS_S3_BUCKET_NAME');
  const region = process.env.AWS_REGION || 'ap-northeast-2';
  const s3 = new S3Client({
    region,
    credentials: {
      accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
    },
  });

  console.log(`[C-2b-del] mode=${EXECUTE ? 'EXECUTE' : 'DRY-RUN'} bucket=${bucket}`);
  const legacyKeys = await listLegacyKeys(s3, bucket);
  console.log(`[C-2b-del] listed legacy objects: ${legacyKeys.length}`);

  const toDelete = [];
  const orphans = [];
  for (const legacyKey of legacyKeys) {
    const newKey = toNewKey(legacyKey);
    if (!newKey) continue;
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: newKey }));
      toDelete.push(legacyKey);
    } catch {
      orphans.push(legacyKey);
      console.warn(`[C-2b-del] orphan (no twin): ${legacyKey}`);
    }
  }

  if (INCLUDE_ORPHANS) {
    toDelete.push(...orphans);
  }

  console.log(
    `[C-2b-del] twin_deletes=${toDelete.length - (INCLUDE_ORPHANS ? orphans.length : 0)} orphans=${orphans.length} include_orphans=${INCLUDE_ORPHANS} total_delete=${toDelete.length}`,
  );

  if (!EXECUTE) {
    for (const k of toDelete.slice(0, 10)) console.log(`[C-2b-del] would delete: ${k}`);
    if (toDelete.length > 10) console.log(`[C-2b-del] ... and ${toDelete.length - 10} more`);
    console.log('[C-2b-del] dry-run only — re-run with --execute');
    return;
  }

  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += 1000) {
    const chunk = toDelete.slice(i, i + 1000);
    const res = await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
    const errCount = res.Errors?.length ?? 0;
    if (errCount) {
      console.error('[C-2b-del] delete errors:', res.Errors.slice(0, 5));
      process.exit(1);
    }
    deleted += chunk.length;
    console.log(`[C-2b-del] deleted batch ${deleted}/${toDelete.length}`);
  }

  console.log(`[C-2b-del] done. deleted=${deleted}`);
}

main().catch((e) => {
  console.error('[C-2b-del] fatal:', e);
  process.exit(1);
});
