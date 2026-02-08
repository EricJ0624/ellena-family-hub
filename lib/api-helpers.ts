import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import sharp from 'sharp';

// 서버 사이드용 Supabase 클라이언트 (DB 작업용)
// Service Role Key 사용: RLS 정책 우회하여 서버 사이드에서 모든 작업 수행 가능
// Next.js App Router 서버 사이드에서는 세션 관리가 필요 없으므로 persistSession: false 설정
export function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase 설정이 누락되었습니다. NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인해주세요.');
  }
  
  // Service Role Key 사용: RLS 정책 우회
  // 서버 사이드용 클라이언트: 세션 관리 불필요
  // Supabase 공식 문서 권장: 서버 사이드에서는 detectSessionInUrl: false 설정
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false, // 서버 사이드에서는 URL에서 세션 감지 불필요
    },
  });
}

// --- [UTILITY] 환경 변수 체크 함수 ---
export function checkCloudinaryConfig(): { available: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.CLOUDINARY_CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
  if (!process.env.CLOUDINARY_API_KEY) missing.push('CLOUDINARY_API_KEY');
  if (!process.env.CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');
  return { available: missing.length === 0, missing };
}

export function checkS3Config(): { available: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.AWS_S3_BUCKET_NAME) missing.push('AWS_S3_BUCKET_NAME');
  if (!process.env.AWS_ACCESS_KEY_ID) missing.push('AWS_ACCESS_KEY_ID');
  if (!process.env.AWS_SECRET_ACCESS_KEY) missing.push('AWS_SECRET_ACCESS_KEY');
  if (!process.env.AWS_REGION) missing.push('AWS_REGION');
  return { available: missing.length === 0, missing };
}

// --- [SINGLETON PATTERN] Cloudinary 설정 (한 번만 초기화) ---
let cloudinaryInitialized = false;

function initializeCloudinary() {
  if (!cloudinaryInitialized) {
    const config = checkCloudinaryConfig();
    if (!config.available) {
      throw new Error(`Cloudinary 환경 변수가 설정되지 않았습니다: ${config.missing.join(', ')}`);
    }
    
    // 환경 변수 안전하게 가져오기 (Non-null assertion 제거)
    // checkCloudinaryConfig()로 이미 검증했으므로 안전하게 사용 가능
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    
    // 추가 안전 검증 (이중 체크)
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(`Cloudinary 환경 변수가 설정되지 않았습니다: ${config.missing.join(', ')}`);
    }
    
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
    cloudinaryInitialized = true;
  }
}

// --- [UTILITY] AWS 리전 정리 함수 (환경 변수에서 리전 코드만 추출) ---
function normalizeAwsRegion(region?: string): string {
  if (!region) return 'us-east-1';
  
  // 공백 제거 및 소문자 변환
  const cleaned = region.trim().toLowerCase();
  
  // "Asia Pacific (Sydney) ap-southeast-2" 형식에서 "ap-southeast-2"만 추출
  // AWS 리전 형식: {prefix}-{direction}-{number} (예: ap-southeast-2, us-east-1)
  const regionMatch = cleaned.match(/([a-z]+-[a-z]+-\d+)/);
  if (regionMatch) {
    return regionMatch[1];
  }
  
  // 이미 올바른 형식이면 그대로 사용 (공백 제거 후)
  // 예: "ap-southeast-2 " -> "ap-southeast-2"
  return cleaned.replace(/\s+/g, '');
}

// --- [SINGLETON PATTERN] S3 클라이언트 설정 (한 번만 초기화) ---
let s3ClientInstance: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    // AWS 자격 증명 검증
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const awsRegion = process.env.AWS_REGION;
    
    if (!awsAccessKeyId || !awsSecretAccessKey || !awsRegion) {
      const missing = [];
      if (!awsAccessKeyId) missing.push('AWS_ACCESS_KEY_ID');
      if (!awsSecretAccessKey) missing.push('AWS_SECRET_ACCESS_KEY');
      if (!awsRegion) missing.push('AWS_REGION');
      throw new Error(`AWS 자격 증명이 설정되지 않았습니다: ${missing.join(', ')}`);
    }
    
    // Access Key ID 형식 검증
    if (awsAccessKeyId.trim().length < 16 || awsAccessKeyId.trim().length > 128) {
      throw new Error(`AWS_ACCESS_KEY_ID 형식이 올바르지 않습니다. (길이: ${awsAccessKeyId.length})`);
    }
    
    // Secret Access Key 형식 검증 (일반적으로 40자)
    if (awsSecretAccessKey.trim().length < 20 || awsSecretAccessKey.trim().length > 128) {
      throw new Error(`AWS_SECRET_ACCESS_KEY 형식이 올바르지 않습니다. (길이: ${awsSecretAccessKey.length})`);
    }
    
    const normalizedRegion = normalizeAwsRegion(awsRegion);
    
    // 리전 형식 검증 (예: ap-southeast-2, us-east-1)
    if (!normalizedRegion.match(/^[a-z]+-[a-z]+-\d+$/)) {
      throw new Error(`AWS_REGION 형식이 올바르지 않습니다: ${normalizedRegion}`);
    }
    
    s3ClientInstance = new S3Client({
      region: normalizedRegion,
      credentials: {
        accessKeyId: awsAccessKeyId.trim(),
        secretAccessKey: awsSecretAccessKey.trim(),
      },
    });
  }
  return s3ClientInstance;
}

// --- [AUTHENTICATION] Supabase 인증 확인 (중복 제거) ---
export async function authenticateUser(request: NextRequest): Promise<{ user: any } | NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json(
      { error: '인증이 필요합니다.' },
      { status: 401 }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  
  // 서버 사이드에서 토큰 검증
  try {
    // 서버 사이드용 Supabase 클라이언트 생성
    const supabaseServer = getSupabaseServerClient();
    
    // 토큰으로 사용자 정보 가져오기
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    
    if (authError) {
      console.error('인증 오류:', authError);
      return NextResponse.json(
        { error: '인증에 실패했습니다.', details: authError.message },
        { status: 401 }
      );
    }
    
    if (!user) {
      console.error('사용자를 찾을 수 없습니다.');
      return NextResponse.json(
        { error: '인증에 실패했습니다.' },
        { status: 401 }
      );
    }

    return { user };
  } catch (error: any) {
    console.error('인증 처리 오류:', error);
    return NextResponse.json(
      { error: '인증 처리 중 오류가 발생했습니다.', details: error.message },
      { status: 401 }
    );
  }
}

// --- [UTILITY] Base64를 Blob으로 변환 (중복 제거) ---
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const base64Data = base64.split(',')[1] || base64;
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// --- [CLOUDINARY] 파일 업로드 함수 (중복 제거) ---
export async function uploadToCloudinary(
  file: Blob,
  fileName: string,
  mimeType: string,
  userId: string
): Promise<{ url: string; publicId: string }> {
  initializeCloudinary();
  
  const fileType = mimeType.startsWith('image/') ? 'image' : 'video';
  const folder = `family-memories/${userId}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: fileType === 'image' ? 'image' : 'video',
        // 보안 강화: authenticated 모드로 설정 (서명된 URL만 접근 가능)
        access_mode: 'authenticated',
        transformation: fileType === 'image' 
          ? [
              { width: 1920, height: 1920, crop: 'limit', quality: 'auto' },
              { fetch_format: 'auto' }
            ]
          : [
              { quality: 'auto', fetch_format: 'auto' }
            ],
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        } else {
          reject(new Error('Cloudinary 업로드 결과가 없습니다.'));
        }
      }
    );

    // Blob을 Buffer로 변환하여 업로드
    file.arrayBuffer()
      .then(buffer => {
        const nodeBuffer = Buffer.from(buffer);
        uploadStream.end(nodeBuffer);
      })
      .catch(reject);
  });
}

// --- [S3] S3 클라이언트 인스턴스 반환 (중복 제거) ---
export function getS3ClientInstance(): S3Client {
  return getS3Client();
}

// --- [UTILITY] S3 Key 생성 로직 (중복 제거) ---
export function generateS3Key(
  fileName: string,
  mimeType: string,
  userId: string
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const fileType = mimeType.startsWith('image/') ? 'photos' : 'videos';
  const fileExtension = fileName.split('.').pop() || 'jpg';
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  return `originals/${fileType}/${year}/${month}/${userId}/${uniqueId}.${fileExtension}`;
}

// --- [UTILITY] S3 URL 생성 (중복 제거) ---
export function generateS3Url(s3Key: string): string {
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('AWS_S3_BUCKET_NAME 환경 변수가 설정되지 않았습니다.');
  }
  const normalizedRegion = normalizeAwsRegion(process.env.AWS_REGION);
  return `https://${bucketName}.s3.${normalizedRegion}.amazonaws.com/${s3Key}`;
}

// --- [UTILITY] Public Asset URL 생성 (CloudFront 우선) ---
export function generatePublicAssetUrl(s3Key: string): string {
  const cfDomain =
    process.env.AWS_CLOUDFRONT_DOMAIN ||
    process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN;

  if (cfDomain) {
    const normalized = cfDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `https://${normalized}/${s3Key}`;
  }

  return generateS3Url(s3Key);
}

// --- [S3] S3에서 파일 다운로드 (Cloudinary 업로드용) ---
export async function downloadFromS3(s3Key: string): Promise<Blob> {
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('AWS_S3_BUCKET_NAME 환경 변수가 설정되지 않았습니다.');
  }

  const s3Client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
  });

  const response = await s3Client.send(command);
  
  if (!response.Body) {
    throw new Error('S3에서 파일을 가져올 수 없습니다.');
  }

  // Stream을 Blob으로 변환
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  return new Blob([buffer]);
}

// ============================================
// Cloudinary & S3 파일 삭제 함수
// ============================================

/**
 * Cloudinary에서 파일 삭제
 * 
 * @param publicId - Cloudinary Public ID
 * @returns 삭제 성공 여부
 */
export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  try {
    initializeCloudinary();
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok' || result.result === 'not found') {
      return true; // 삭제 성공 또는 이미 삭제됨
    }
    return false;
  } catch (error: any) {
    console.error('Cloudinary 삭제 오류:', error);
    return false; // 삭제 실패해도 계속 진행
  }
}

/**
 * S3에서 파일 삭제
 * 
 * @param s3Key - S3 Key (파일 경로)
 * @returns 삭제 성공 여부
 */
export async function deleteFromS3(s3Key: string): Promise<boolean> {
  try {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      console.warn('AWS_S3_BUCKET_NAME 환경 변수가 설정되지 않았습니다.');
      return false;
    }

    const s3Client = getS3ClientInstance();
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });

    await s3Client.send(command);
    return true;
  } catch (error: any) {
    console.error('S3 삭제 오류:', error);
    return false; // 삭제 실패해도 계속 진행
  }
}

// ============================================
// Multi-tenant 아키텍처: active_group_id 검증
// ============================================

/**
 * API 요청에서 active_group_id 검증 및 추출
 * 
 * @param request - NextRequest 객체
 * @param userId - 인증된 사용자 ID
 * @returns groupId 또는 에러 응답
 */
export async function validateActiveGroupId(
  request: NextRequest,
  userId: string
): Promise<{ groupId: string } | NextResponse> {
  // 1. 요청 본문에서 groupId 추출
  let body;
  try {
    body = await request.json().catch(() => ({})); // JSON 파싱 실패 시 빈 객체
  } catch {
    // JSON이 없는 경우 (GET 요청 등) 쿼리 파라미터에서 추출
    const searchParams = request.nextUrl.searchParams;
    const groupIdFromQuery = searchParams.get('groupId');
    
    if (groupIdFromQuery) {
      const { checkPermission } = await import('@/lib/permissions');
      const permissionResult = await checkPermission(
        userId,
        groupIdFromQuery,
        null, // MEMBER 이상 권한 필요
        userId
      );
      
      if (!permissionResult.success) {
        return NextResponse.json(
          { error: '그룹 접근 권한이 없습니다.' },
          { status: 403 }
        );
      }
      
      return { groupId: groupIdFromQuery };
    }
    
    return NextResponse.json(
      { error: 'groupId가 필요합니다.' },
      { status: 400 }
    );
  }

  const { groupId } = body || {};

  // 2. groupId 필수 검증
  if (!groupId) {
    return NextResponse.json(
      { error: 'groupId가 필요합니다.' },
      { status: 400 }
    );
  }

  // 3. UUID 형식 검증
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(groupId)) {
    return NextResponse.json(
      { error: '유효하지 않은 groupId 형식입니다.' },
      { status: 400 }
    );
  }

  // 4. 그룹 멤버십 권한 검증
  const { checkPermission } = await import('@/lib/permissions');
  const permissionResult = await checkPermission(
    userId,
    groupId,
    null, // MEMBER 이상 권한 필요
    userId
  );

  if (!permissionResult.success) {
    return NextResponse.json(
      { error: '그룹 접근 권한이 없습니다.' },
      { status: 403 }
    );
  }

  return { groupId };
}

/**
 * Supabase 쿼리에 groupId 필터 추가 (보안 강화)
 * 
 * @param query - Supabase 쿼리 빌더
 * @param groupId - 그룹 ID (필수)
 * @returns 필터링된 쿼리
 */
export function ensureGroupIdFilter<T>(
  query: any,
  groupId: string | null | undefined
): any {
  if (!groupId) {
    throw new Error('groupId는 필수입니다. Multi-tenant 아키텍처에서는 모든 데이터 조회에 groupId가 필요합니다.');
  }
  
  // UUID 형식 검증
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(groupId)) {
    throw new Error('유효하지 않은 groupId 형식입니다.');
  }
  
  return query.eq('group_id', groupId);
}

// ============================================
// 그룹 권한 메타데이터 포함 업로드 함수들
// ============================================

/**
 * Cloudinary 업로드 함수 (그룹 권한 메타데이터 포함)
 * 
 * @param file - 업로드할 파일 (Blob)
 * @param fileName - 파일명
 * @param mimeType - MIME 타입
 * @param userId - 사용자 ID
 * @param groupId - 그룹 ID (선택사항, 권한 검증용)
 * @returns 업로드 결과 (url, publicId)
 */
export async function uploadToCloudinaryWithGroup(
  file: Blob,
  fileName: string,
  mimeType: string,
  userId: string,
  groupId?: string,
  options?: {
    maxDimension?: number;
    quality?: string;
    fetchFormat?: string;
  }
): Promise<{ url: string; publicId: string; format?: string }> {
  initializeCloudinary();
  
  const fileType = mimeType.startsWith('image/') ? 'image' : 'video';
  const folder = groupId 
    ? `family-memories/${groupId}/${userId}`
    : `family-memories/${userId}`;

  // 그룹 ID를 메타데이터에 포함 (권한 검증용)
  const context: Record<string, string> = {};
  if (groupId) {
    context.groupId = groupId;
    context.userId = userId;
  }

  const maxDimension = options?.maxDimension || 1920;
  const quality = options?.quality || 'auto';
  const fetchFormat = options?.fetchFormat || 'auto';

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: fileType === 'image' ? 'image' : 'video',
        context, // 메타데이터에 그룹 ID 포함
        // 보안 강화: authenticated 모드로 설정 (서명된 URL만 접근 가능)
        access_mode: 'authenticated',
        transformation: fileType === 'image' 
          ? [
              { width: maxDimension, height: maxDimension, crop: 'limit', quality },
              { fetch_format: fetchFormat }
            ]
          : [
              { quality, fetch_format: fetchFormat }
            ],
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format,
          });
        } else {
          reject(new Error('Cloudinary 업로드 결과가 없습니다.'));
        }
      }
    );

    file.arrayBuffer()
      .then(buffer => {
        const nodeBuffer = Buffer.from(buffer);
        uploadStream.end(nodeBuffer);
      })
      .catch(reject);
  });
}

/**
 * S3 Key 생성 (그룹 권한 메타데이터 포함)
 * 
 * @param fileName - 파일명
 * @param mimeType - MIME 타입
 * @param userId - 사용자 ID
 * @param groupId - 그룹 ID (선택사항, 권한 검증용)
 * @returns S3 Key
 */
export function generateS3KeyWithGroup(
  fileName: string,
  mimeType: string,
  userId: string,
  groupId?: string
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const fileType = mimeType.startsWith('image/') ? 'photos' : 'videos';
  const fileExtension = fileName.split('.').pop() || 'jpg';
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  
  // 그룹 ID가 있으면 경로에 포함
  const groupPath = groupId ? `groups/${groupId}/` : '';
  return `originals/${groupPath}${fileType}/${year}/${month}/${userId}/${uniqueId}.${fileExtension}`;
}

/**
 * S3 App 이미지 Key 생성 (마스터 Key 기반)
 */
export function generateAppS3KeyFromMasterKey(masterKey: string): string {
  let appKey = masterKey.replace(/^originals\//, 'app/');
  const dotIndex = appKey.lastIndexOf('.');
  if (dotIndex === -1) {
    return `${appKey}_app`;
  }
  return `${appKey.slice(0, dotIndex)}_app${appKey.slice(dotIndex)}`;
}

/**
 * S3에 파일 업로드 (그룹 권한 메타데이터 포함)
 * 
 * @param file - 업로드할 파일 (Blob)
 * @param fileName - 파일명
 * @param mimeType - MIME 타입
 * @param userId - 사용자 ID
 * @param groupId - 그룹 ID (선택사항, 권한 검증용)
 * @returns 업로드 결과 (url, key)
 */
export async function uploadToS3WithGroup(
  file: Blob,
  fileName: string,
  mimeType: string,
  userId: string,
  groupId?: string
): Promise<{ url: string; key: string }> {
  const s3Key = generateS3KeyWithGroup(fileName, mimeType, userId, groupId);
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  
  if (!bucketName) {
    throw new Error('AWS_S3_BUCKET_NAME 환경 변수가 설정되지 않았습니다.');
  }

  const s3Client = getS3ClientInstance();
  
  // S3 메타데이터에 그룹 ID 포함 (권한 검증용)
  const metadata: Record<string, string> = {};
  if (groupId) {
    metadata['groupId'] = groupId;
    metadata['userId'] = userId;
  }

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucketName,
      Key: s3Key,
      Body: file,
      ContentType: mimeType,
      Metadata: metadata, // 그룹 ID를 메타데이터에 포함
      ACL: 'private', // 보안: private로 설정
    },
  });

  await upload.done();

  const publicUrl = generatePublicAssetUrl(s3Key);
  return { url: publicUrl, key: s3Key };
}

/**
 * S3에 파일 업로드 (Key 지정)
 */
export async function uploadToS3WithGroupAndKey(
  file: Buffer,
  key: string,
  mimeType: string,
  userId: string,
  groupId?: string
): Promise<{ url: string; key: string }> {
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('AWS_S3_BUCKET_NAME 환경 변수가 설정되지 않았습니다.');
  }

  const s3Client = getS3ClientInstance();
  const metadata: Record<string, string> = {};
  if (groupId) {
    metadata['groupId'] = groupId;
    metadata['userId'] = userId;
  }

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucketName,
      Key: key,
      Body: file,
      ContentType: mimeType,
      Metadata: metadata,
      ACL: 'private',
    },
  });

  await upload.done();
  const publicUrl = generatePublicAssetUrl(key);
  return { url: publicUrl, key };
}

export function replaceFileExtension(fileName: string, newExtension: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, '');
  return `${baseName}.${newExtension}`;
}

export function getMimeTypeFromFormat(format?: string, fallback?: string): string {
  if (!format) return fallback || 'image/jpeg';
  return `image/${format}`;
}

export async function downloadFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`원격 파일 다운로드 실패: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function getImageMetadata(buffer: Buffer): Promise<{ width?: number; height?: number; format?: string }> {
  const metadata = await sharp(buffer).metadata();
  return { width: metadata.width, height: metadata.height, format: metadata.format };
}

export async function resizeImageBuffer(
  buffer: Buffer,
  maxDimension: number,
  format: string,
  quality: number
): Promise<Buffer> {
  const pipeline = sharp(buffer).resize({
    width: maxDimension,
    height: maxDimension,
    fit: 'inside',
    withoutEnlargement: true,
  });

  switch (format) {
    case 'png':
      return pipeline.png({ quality, progressive: true }).toBuffer();
    case 'webp':
      return pipeline.webp({ quality }).toBuffer();
    case 'avif':
      return pipeline.avif({ quality }).toBuffer();
    default:
      return pipeline.jpeg({ quality, progressive: true }).toBuffer();
  }
}

// ============================================
// 🔒 SECURITY: 데이터 격리 및 권한 검증 헬퍼 함수
// ============================================

/**
 * ✅ SECURITY: 그룹 소속 및 권한 검증 (통합 헬퍼)
 * 
 * 모든 API에서 사용하여 IDOR 공격 방지 및 데이터 격리 보장
 * 
 * @param userId - 검증할 사용자 ID
 * @param groupId - 검증할 그룹 ID
 * @param requiredRole - 필요한 최소 권한 ('ADMIN' | 'MEMBER' | null)
 * @returns PermissionResult 또는 NextResponse (권한 없음)
 * 
 * @example
 * ```typescript
 * const permissionCheck = await verifyGroupAccess(user.id, groupId, 'ADMIN');
 * if (permissionCheck instanceof NextResponse) {
 *   return permissionCheck; // 권한 없음 응답 반환
 * }
 * // permissionCheck는 PermissionResult 타입
 * ```
 */
export async function verifyGroupAccess(
  userId: string,
  groupId: string,
  requiredRole: 'ADMIN' | 'MEMBER' | null = null
): Promise<import('@/lib/permissions').PermissionResult | NextResponse> {
  const { checkPermission } = await import('@/lib/permissions');
  
  const permissionResult = await checkPermission(
    userId,
    groupId,
    requiredRole,
    userId // IDOR 방지
  );

  if (!permissionResult.success) {
    return NextResponse.json(
      { 
        error: '그룹 접근 권한이 없습니다.',
        details: permissionResult.error,
        groupId,
      },
      { status: 403 }
    );
  }

  return permissionResult;
}

/**
 * ✅ SECURITY: 리소스가 특정 그룹에 속하는지 검증
 * 
 * IDOR 공격 방지: 사용자가 접근 권한이 없는 그룹의 리소스에 접근하는 것을 차단
 * 
 * @param tableName - 테이블 이름 (예: 'memory_vault', 'family_tasks')
 * @param resourceId - 리소스 ID
 * @param expectedGroupId - 예상되는 그룹 ID
 * @returns boolean - 검증 성공 여부
 */
export async function verifyResourceBelongsToGroup(
  tableName: string,
  resourceId: string,
  expectedGroupId: string
): Promise<boolean> {
  try {
    const supabase = getSupabaseServerClient();
    
    const { data, error } = await supabase
      .from(tableName)
      .select('group_id')
      .eq('id', resourceId)
      .single();

    if (error || !data) {
      console.error(`리소스 그룹 검증 실패 (${tableName}):`, error);
      return false;
    }

    return data.group_id === expectedGroupId;
  } catch (error) {
    console.error('리소스 그룹 검증 중 오류:', error);
    return false;
  }
}

/**
 * ✅ SECURITY: 시스템 관리자가 특정 그룹에 임시 접근 권한이 있는지 확인
 * 
 * 시스템 관리자는 그룹 멤버가 아니더라도 승인된 접근 요청이 있으면 임시로 접근 가능
 * 
 * @param adminId - 시스템 관리자 ID
 * @param groupId - 그룹 ID
 * @returns boolean - 접근 가능 여부
 */
export async function canSystemAdminAccessGroup(
  adminId: string,
  groupId: string
): Promise<boolean> {
  try {
    const supabase = getSupabaseServerClient();
    
    // 1. 시스템 관리자 여부 확인
    const { data: isAdmin } = await supabase.rpc('is_system_admin', {
      user_id_param: adminId,
    });
    
    if (!isAdmin) {
      return false;
    }
    
    // 2. 접근 권한 확인
    const { data: canAccess } = await supabase.rpc('can_access_group_dashboard', {
      group_id_param: groupId,
      admin_id_param: adminId,
    });
    
    return canAccess === true;
  } catch (error) {
    console.error('시스템 관리자 접근 권한 확인 중 오류:', error);
    return false;
  }
}
