import type { TravelEmergencyContacts, TravelEmergencyCountryContact } from './types';
import { normalizeEmergencyContacts } from './document-meta';

/** 외교부 영사콜센터 (한국인 해외 긴급, 24시간) */
export const KOREA_CONSULAR_CALL_CENTER = '+82-2-3210-0404';

export type CountryEmergencyProfile = {
  code: string;
  nameKo: string;
  /** 현지 긴급(경찰/응급 등) */
  local: string;
  /** 주재 한국 공관 긴급/대표 (안내용, 변경될 수 있음) */
  embassy: string;
  aliases: string[];
};

/**
 * 인기 여행지 중심 정적 맵.
 * 대사관 번호는 안내 목적이며, 출국 전 외교부(0404.go.kr) 확인을 권장.
 */
const COUNTRY_PROFILES: CountryEmergencyProfile[] = [
  {
    code: 'KR',
    nameKo: '한국',
    local: '경찰 112 / 소방·응급 119',
    embassy: '외국인 관광통역안내 1330 · 주한 자국 대사관은 국적별 확인',
    aliases: [
      '한국', '대한민국', 'korea', 'south korea',
      '서울', 'seoul', '부산', 'busan', '제주', 'jeju', '인천', 'incheon',
      '대구', 'daegu', '대전', 'daejeon', '광주', 'gwangju', '울산', 'ulsan',
      '경기', '강원', '경주', 'gyeongju', '전주', 'jeonju', '여수', 'yeosu',
    ],
  },
  {
    code: 'JP',
    nameKo: '일본',
    local: '경찰 110 / 소방·응급 119',
    embassy: '주일본한국대사관 +81-3-3455-2601 (긴급 +81-70-7600-3797)',
    aliases: [
      '일본', 'japan', '도쿄', 'tokyo', '오사카', 'osaka', '교토', 'kyoto', '후쿠오카', 'fukuoka',
      '삿포로', 'sapporo', '나고야', 'nagoya', '오키나와', 'okinawa', '요코하마', 'yokohama',
      '고베', 'kobe', '히로시마', 'hiroshima', '오키나와현',
    ],
  },
  {
    code: 'HK',
    nameKo: '홍콩',
    local: '경찰·응급 999',
    embassy: '주홍콩총영사관 +852-2529-4141',
    aliases: ['홍콩', 'hong kong', 'hongkong'],
  },
  {
    code: 'TW',
    nameKo: '대만',
    local: '경찰 110 / 소방·응급 119',
    embassy: '주타이베이대표부 +886-2-2758-8320',
    aliases: ['대만', '타이완', 'taiwan', '타이베이', 'taipei', '가오슝', 'kaohsiung'],
  },
  {
    code: 'CN',
    nameKo: '중국',
    local: '경찰 110 / 응급 120 / 소방 119',
    embassy: '주중국한국대사관 +86-10-8531-0700',
    aliases: [
      '중국', 'china', '베이징', 'beijing', '상하이', 'shanghai', '광저우', 'guangzhou',
      '선전', 'shenzhen', '칭다오', 'qingdao', '다롄', 'dalian', '시안', 'xian', "xi'an",
    ],
  },
  {
    code: 'SG',
    nameKo: '싱가포르',
    local: '경찰 999 / 응급·소방 995',
    embassy: '주싱가포르한국대사관 +65-6256-1188',
    aliases: ['싱가포르', 'singapore', '싱가폴'],
  },
  {
    code: 'TH',
    nameKo: '태국',
    local: '관광경찰 1155 / 경찰 191 / 응급 1669',
    embassy: '주태국한국대사관 +66-2-247-7537',
    aliases: ['태국', 'thailand', '방콕', 'bangkok', '파타야', 'pattaya', '푸켓', 'phuket', '치앙마이', 'chiang mai'],
  },
  {
    code: 'VN',
    nameKo: '베트남',
    local: '경찰 113 / 소방 114 / 응급 115',
    embassy: '주베트남한국대사관 +84-24-3831-5110',
    aliases: [
      '베트남', 'vietnam', '하노이', 'hanoi', '호치민', 'ho chi minh', '호찌민', '다낭', 'danang', 'da nang',
      '나트랑', 'nha trang', '푸꾸옥', 'phu quoc',
    ],
  },
  {
    code: 'PH',
    nameKo: '필리핀',
    local: '긴급 911 / 경찰 117',
    embassy: '주필리핀한국대사관 +63-2-8856-9210',
    aliases: ['필리핀', 'philippines', '마닐라', 'manila', '세부', 'cebu', '보홀', 'bohol', '보라카이', 'boracay'],
  },
  {
    code: 'MY',
    nameKo: '말레이시아',
    local: '경찰 999 / 응급 999',
    embassy: '주말레이시아한국대사관 +60-3-4251-2336',
    aliases: ['말레이시아', 'malaysia', '쿠알라룸푸르', 'kuala lumpur', '페낭', 'penang', '코타키나발루', 'kota kinabalu'],
  },
  {
    code: 'ID',
    nameKo: '인도네시아',
    local: '경찰 110 / 응급 118·119',
    embassy: '주인도네시아한국대사관 +62-21-2967-2555',
    aliases: ['인도네시아', 'indonesia', '자카르타', 'jakarta', '발리', 'bali', '덴파사르', 'denpasar'],
  },
  {
    code: 'US',
    nameKo: '미국',
    local: '긴급 911',
    embassy: '주미국한국대사관 +1-202-939-5600',
    aliases: [
      '미국', 'usa', 'united states', '뉴욕', 'new york', '로스앤젤레스', 'los angeles',
      '샌프란시스코', 'san francisco', '하와이', 'hawaii', '라스베이거스', 'las vegas', '시애틀', 'seattle',
      '시카고', 'chicago', '보스턴', 'boston',
    ],
  },
  {
    code: 'CA',
    nameKo: '캐나다',
    local: '긴급 911',
    embassy: '주캐나다한국대사관 +1-613-244-5010',
    aliases: ['캐나다', 'canada', '밴쿠버', 'vancouver', '토론토', 'toronto', '몬트리올', 'montreal'],
  },
  {
    code: 'AU',
    nameKo: '호주',
    local: '긴급 000 (휴대폰 112)',
    embassy: '주호주한국대사관 +61-2-6270-4100',
    aliases: ['호주', 'australia', '시드니', 'sydney', '멜버른', 'melbourne', '브리즈번', 'brisbane', '골드코스트', 'gold coast'],
  },
  {
    code: 'NZ',
    nameKo: '뉴질랜드',
    local: '긴급 111',
    embassy: '주뉴질랜드한국대사관 +64-4-473-9073',
    aliases: ['뉴질랜드', 'new zealand', '오클랜드', 'auckland', '웰링턴', 'wellington', '퀸스타운', 'queenstown'],
  },
  {
    code: 'GB',
    nameKo: '영국',
    local: '긴급 999 / 112',
    embassy: '주영국한국대사관 +44-20-7227-5500',
    aliases: ['영국', 'united kingdom', 'england', '런던', 'london', '에든버러', 'edinburgh'],
  },
  {
    code: 'FR',
    nameKo: '프랑스',
    local: '긴급 112 / 경찰 17 / 응급 15',
    embassy: '주프랑스한국대사관 +33-1-4405-2050',
    aliases: ['프랑스', 'france', '파리', 'paris', '니스', 'nice', '리옹', 'lyon'],
  },
  {
    code: 'DE',
    nameKo: '독일',
    local: '긴급 112 / 경찰 110',
    embassy: '주독일한국대사관 +49-30-26065-0',
    aliases: ['독일', 'germany', '베를린', 'berlin', '뮌헨', 'munich', '프랑크푸르트', 'frankfurt'],
  },
  {
    code: 'IT',
    nameKo: '이탈리아',
    local: '긴급 112',
    embassy: '주이탈리아한국대사관 +39-06-802461',
    aliases: ['이탈리아', 'italy', '로마', 'rome', '밀라노', 'milan', '베니스', 'venice', '피렌체', 'florence'],
  },
  {
    code: 'ES',
    nameKo: '스페인',
    local: '긴급 112',
    embassy: '주스페인한국대사관 +34-91-353-2000',
    aliases: ['스페인', 'spain', '마드리드', 'madrid', '바르셀로나', 'barcelona'],
  },
  {
    code: 'CH',
    nameKo: '스위스',
    local: '긴급 112 / 경찰 117',
    embassy: '주스위스한국대사관 +41-31-356-2444',
    aliases: ['스위스', 'switzerland', '취리히', 'zurich', '제네바', 'geneva', '인터라켄', 'interlaken'],
  },
  {
    code: 'AE',
    nameKo: '아랍에미리트',
    local: '경찰 999 / 응급 998 / 소방 997',
    embassy: '주아랍에미리트한국대사관 +971-2-449-4210',
    aliases: ['아랍에미리트', 'uae', '두바이', 'dubai', '아부다비', 'abu dhabi'],
  },
  {
    code: 'TR',
    nameKo: '튀르키예',
    local: '긴급 112',
    embassy: '주튀르키예한국대사관 +90-312-468-4821',
    aliases: ['튀르키예', '터키', 'turkey', 'türkiye', '이스탄불', 'istanbul', '앙카라', 'ankara'],
  },
  {
    code: 'GU',
    nameKo: '괌',
    local: '긴급 911',
    embassy: '주괌한국총영사관 +1-671-647-6488',
    aliases: ['괌', 'guam'],
  },
  {
    code: 'MO',
    nameKo: '마카오',
    local: '긴급 999',
    embassy: '주홍콩총영사관(마카오 관할) +852-2529-4141',
    aliases: ['마카오', 'macau', 'macao'],
  },
];

function normalizeDestination(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[，,、/|·•〜~＋+]/g, ' ')
    .replace(/[()[\]{}「」『』]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 짧은 영문 별칭은 단어 경계로만 매칭 */
function textContainsAlias(haystack: string, alias: string): boolean {
  if (!alias || !haystack) return false;
  if (haystack === alias) return true;
  const compact = alias.replace(/\s+/g, '');
  if (/^[a-z0-9.'_-]+$/i.test(compact) && compact.length <= 3) {
    const re = new RegExp(`(?:^|\\s)${escapeRegExp(alias)}(?:\\s|$)`, 'i');
    return re.test(haystack);
  }
  return haystack.includes(alias);
}

/** 한 문자열에서 매칭되는 모든 국가 (등장 순) */
export function matchCountriesFromText(raw: string | null | undefined): CountryEmergencyProfile[] {
  const text = normalizeDestination(raw ?? '');
  if (!text) return [];

  const found = new Map<string, { profile: CountryEmergencyProfile; index: number; aliasLen: number }>();
  for (const profile of COUNTRY_PROFILES) {
    for (const alias of profile.aliases) {
      const a = normalizeDestination(alias);
      if (a.length < 2) continue;
      if (!textContainsAlias(text, a)) continue;
      const index = text.indexOf(a);
      const prev = found.get(profile.code);
      if (!prev || index < prev.index || (index === prev.index && a.length > prev.aliasLen)) {
        found.set(profile.code, { profile, index: index < 0 ? 9999 : index, aliasLen: a.length });
      }
    }
  }

  return [...found.values()]
    .sort((a, b) => a.index - b.index || b.aliasLen - a.aliasLen)
    .map((x) => x.profile);
}

export function collectCountriesFromLocationParts(
  parts: Array<string | null | undefined>,
): CountryEmergencyProfile[] {
  const ordered: CountryEmergencyProfile[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    for (const profile of matchCountriesFromText(part)) {
      if (seen.has(profile.code)) continue;
      seen.add(profile.code);
      ordered.push(profile);
    }
  }
  return ordered;
}

function flattenContacts(countries: TravelEmergencyCountryContact[]): {
  local: string | null;
  embassy: string | null;
} {
  if (countries.length === 0) return { local: null, embassy: null };
  if (countries.length === 1) {
    return { local: countries[0]!.local, embassy: countries[0]!.embassy };
  }
  return {
    local: countries.map((c) => `[${c.nameKo}] ${c.local}`).join(' · '),
    embassy: countries.map((c) => `[${c.nameKo}] ${c.embassy}`).join(' · '),
  };
}

/** 주한 외국 공관 (외국인→한국 여행 시). 안내용, 변경될 수 있음. */
const MISSIONS_IN_KOREA: Record<string, string> = {
  US: '주한미국대사관 +82-2-397-4114',
  JP: '주한일본대사관 +82-2-2170-5200',
  CN: '주한중국대사관 +82-2-738-1038',
  TW: '주한타이베이대표부 +82-2-2187-2000',
  HK: '주한홍콩경제무역대표부 관련은 중국/홍콩 당국 안내 참고',
  SG: '주한싱가포르대사관 +82-2-774-2464',
  TH: '주한태국대사관 +82-2-795-3098',
  VN: '주한베트남대사관 +82-2-739-2065',
  PH: '주한필리핀대사관 +82-2-796-7387',
  MY: '주한말레이시아대사관 +82-2-795-9200',
  ID: '주한인도네시아대사관 +82-2-783-5675',
  AU: '주한호주대사관 +82-2-2003-0100',
  NZ: '주한뉴질랜드대사관 +82-2-3701-7000',
  GB: '주한영국대사관 +82-2-3210-5500',
  FR: '주한프랑스대사관 +82-2-3149-4300',
  DE: '주한독일대사관 +82-2-748-4114',
  IT: '주한이탈리아대사관 +82-2-750-0200',
  ES: '주한스페인대사관 +82-2-794-3581',
  CA: '주한캐나다대사관 +82-2-3783-6000',
  CH: '주한스위스대사관 +82-2-739-9511',
  AE: '주한아랍에미리트대사관 +82-2-790-3235',
  TR: '주한튀르키예대사관 +82-2-794-4255',
};

const NAT_NAME_KO: Record<string, string> = {
  KR: '한국',
  US: '미국',
  JP: '일본',
  CN: '중국',
  TW: '대만',
  HK: '홍콩',
  SG: '싱가포르',
  TH: '태국',
  VN: '베트남',
  PH: '필리핀',
  MY: '말레이시아',
  ID: '인도네시아',
  AU: '호주',
  NZ: '뉴질랜드',
  GB: '영국',
  FR: '프랑스',
  DE: '독일',
  IT: '이탈리아',
  ES: '스페인',
  CA: '캐나다',
  CH: '스위스',
  AE: '아랍에미리트',
  TR: '튀르키예',
  GU: '괌',
  MO: '마카오',
};

function normalizeNationalityCodes(raw: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const code = String(r ?? '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2}$/.test(code) || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out.length ? out : ['KR'];
}

function nationalityNameKo(code: string): string {
  return NAT_NAME_KO[code] || code;
}

/**
 * 국적 × 여행국 → 대사관/공관 안내
 * - 한국인 해외: 해당국 주재 한국 공관
 * - 외국인 한국: 주한 자국 공관
 * - 그 외: 국적·현지 기준 확인 안내
 */
export function resolveEmbassyForNationalityInDestination(
  nationality: string,
  dest: CountryEmergencyProfile,
): string {
  const nat = nationality.toUpperCase();
  if (nat === dest.code) {
    return '자국 체류 — 현지 긴급만 해당';
  }
  if (nat === 'KR') {
    return dest.embassy;
  }
  if (dest.code === 'KR') {
    return (
      MISSIONS_IN_KOREA[nat] ||
      `주한 ${nationalityNameKo(nat)} 대사관/대표부 (국적 기준 확인)`
    );
  }
  return `${nationalityNameKo(nat)} 국적 — ${dest.nameKo} 주재 자국 공관 확인`;
}

function buildEmbassyLinesForDest(
  dest: CountryEmergencyProfile,
  nationalities: string[],
): string {
  return nationalities
    .map((nat) => `[${nationalityNameKo(nat)}] ${resolveEmbassyForNationalityInDestination(nat, dest)}`)
    .join(' · ');
}

function resolveConsularLine(nationalities: string[], destCodes: string[]): string {
  const hasKrTraveler = nationalities.includes('KR');
  const hasForeignDest = destCodes.some((c) => c !== 'KR');
  const koreaOnlyDest = destCodes.length > 0 && destCodes.every((c) => c === 'KR');
  const hasForeignTraveler = nationalities.some((n) => n !== 'KR');

  if (hasKrTraveler && hasForeignDest) return KOREA_CONSULAR_CALL_CENTER;
  if (koreaOnlyDest && hasForeignTraveler) return '외국인 관광통역안내 1330';
  if (hasKrTraveler) return KOREA_CONSULAR_CALL_CENTER;
  return '자국 영사 지원은 국적 대사관/외무부에 문의';
}

/**
 * 여행지(+추가 위치) + 여행자 국적 → 긴급연락처
 */
export function buildEmergencyContactsFromDestination(
  destination: string | null | undefined,
  extraLocationParts: Array<string | null | undefined> = [],
  travelerNationalities: Array<string | null | undefined> = [],
): TravelEmergencyContacts {
  const nats = normalizeNationalityCodes(travelerNationalities);
  const destProfiles = collectCountriesFromLocationParts([destination, ...extraLocationParts]);
  const countries = destProfiles.map((p) => ({
    code: p.code,
    nameKo: p.nameKo,
    local: p.local,
    embassy: buildEmbassyLinesForDest(p, nats),
  }));
  const flat = flattenContacts(countries);
  return {
    ...normalizeEmergencyContacts({
      local: flat.local,
      consular: resolveConsularLine(
        nats,
        destProfiles.map((p) => p.code),
      ),
      embassy: flat.embassy,
    }),
    countries,
  };
}

export type ResolvedEmergencyForDocument = {
  consular: string;
  countries: TravelEmergencyCountryContact[];
  unresolvedHint: string | null;
};

/** 일정표 표시용: 여행국(현지 긴급) + 참가자 국적(대사관) */
export function resolveEmergencyForDocument(params: {
  destination?: string | null;
  stored?: TravelEmergencyContacts | null;
  locationParts?: Array<string | null | undefined>;
  travelerNationalities?: Array<string | null | undefined>;
}): ResolvedEmergencyForDocument {
  const nats = normalizeNationalityCodes(params.travelerNationalities ?? []);
  const destProfiles = collectCountriesFromLocationParts([
    params.destination,
    ...(params.locationParts ?? []),
  ]);

  const merged: TravelEmergencyCountryContact[] = destProfiles.map((p) => ({
    code: p.code,
    nameKo: p.nameKo,
    local: p.local,
    embassy: buildEmbassyLinesForDest(p, nats),
  }));

  if (merged.length === 0) {
    const manual = normalizeEmergencyContacts(params.stored);
    if (manual.local || manual.embassy) {
      merged.push({
        code: 'STORED',
        nameKo: '저장된 연락처',
        local: manual.local || '—',
        embassy: manual.embassy || '—',
      });
    }
  }

  return {
    consular: resolveConsularLine(
      nats,
      merged.map((c) => c.code).filter((c) => c !== 'STORED'),
    ),
    countries: merged,
    unresolvedHint:
      merged.length === 0
        ? '여행 국가를 아직 찾지 못했습니다. 여행지에 국가/도시명(예: 서울, 오사카)을 넣어 주세요.'
        : null,
  };
}
