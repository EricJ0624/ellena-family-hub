/**
 * Supabase Auth에서 이메일로 사용자 삭제 (서비스 롤 키 필요)
 * 사용: node scripts/delete-user-by-email.js <email>
 * 예: node scripts/delete-user-by-email.js soungtak@gmail.com
 */
const fs = require('fs');
const path = require('path');

// 프로젝트 루트의 .env.local 로드
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const email = process.argv[2];
if (!email) {
  console.error('사용법: node scripts/delete-user-by-email.js <email>');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.');
  process.exit(1);
}

async function main() {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let page = 1;
  const perPage = 100;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error('사용자 목록 조회 실패:', error.message);
      process.exit(1);
    }
    const user = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (user) {
      const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
      if (delError) {
        console.error('삭제 실패:', delError.message);
        process.exit(1);
      }
      console.log('삭제 완료:', user.email, '(id:', user.id, ')');
      return;
    }
    if (data.users.length < perPage) break;
    page++;
  }
  console.log('해당 이메일 사용자를 찾을 수 없습니다:', email);
}

main();
