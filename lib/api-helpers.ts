import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

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

