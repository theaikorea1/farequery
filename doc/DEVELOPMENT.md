# TradeFare farequery — 개발 기술 문서

> **목적:** 이 문서는 AI(Claude 등)의 도움을 받아 동일 수준의 프로젝트를 처음부터 재현하기 위한 상세 기술 명세서입니다.  
> 구현 배경, 설계 결정, 주요 함정(gotcha), 전체 파일 목록을 모두 포함합니다.

---

## 1. 프로젝트 개요

**TradeFare farequery**는 한국무역협회(KITA)의 해상·항공 참고운임 데이터를 조회하는 내부 팀용 웹 애플리케이션입니다.

- 출처: KITA가 매월 첫째 주 업로드하는 시장 평균 운임
- 해상: 부산(Busan) 출발, TEU/FEU 기준 (USD)
- 항공: 인천(Incheon) 출발, 100kg/300kg/500kg 기준 (USD)
- 데이터 범위: 2015년~현재, 약 13,500행, 목적지 도시 약 127개

### 전체 시스템 구성

```
[KITA 웹사이트]
    ↓  kita_api_scraper.py (Python, 별도 프로젝트)
[FareExtract/API_output/]
    ↓  수동 복사
[farequery/FareDB/]  ← Next.js 앱이 직접 읽는 CSV 파일
    ↓
[Next.js 웹앱 (farequery)]  →  사용자 브라우저
```

스크래퍼 프로젝트(`FareExtract`)는 별도이며, 이 문서는 **웹앱(farequery)** 구현만 다룹니다.

---

## 2. 기술 스택 (정확한 버전 포함)

```json
{
  "next": "16.2.6",
  "react": "19.2.4",
  "react-dom": "19.2.4",
  "papaparse": "^5.5.3",
  "recharts": "^3.8.1",
  "xlsx": "^0.18.5"
}
```

```json
{
  "@tailwindcss/postcss": "^4",
  "@types/node": "^20",
  "@types/papaparse": "^5.5.2",
  "@types/react": "^19",
  "@types/react-dom": "^19",
  "eslint": "^9",
  "eslint-config-next": "16.2.6",
  "tailwindcss": "^4",
  "typescript": "^5"
}
```

### ⚠️ 버전별 중요 주의사항

| 항목 | 주의 내용 |
|---|---|
| **Next.js 16** | `params`, `searchParams`가 Promise로 변경됨. `await params` 또는 `use(params)` 필수 |
| **Next.js 16** | `node_modules/next/dist/docs/` 에 공식 가이드 있음. 코드 작성 전 반드시 확인 |
| **Tailwind v4** | `tailwind.config.js` 없음. 설정은 CSS의 `@theme` 블록에서 처리. `@import "tailwindcss"` 방식 |
| **React 19** | Server Component 기본. 인터랙티브 컴포넌트는 `'use client'` 디렉티브 필수 |
| **papaparse** | Node.js 서버 사이드에서 문자열 입력 시 동기 파싱. `fs.readFileSync` + `Papa.parse()` 조합 사용 |
| **recharts** | Tooltip `formatter` 콜백의 `value` 타입이 `ValueType | undefined`. `number`로 직접 타이핑 시 TypeScript 오류 발생 |

---

## 3. 디렉터리 구조

```
farequery/
├── doc/
│   ├── PROJECT_OVERVIEW.md      프로젝트 전체 개요
│   └── DEVELOPMENT.md           ← 이 파일 (AI 재현용 기술 문서)
│
├── FareDB/                      웹앱 데이터 소스 (CSV)
│   ├── kita_all_freight.csv     해상+항공 통합 (~13,500행)
│   ├── kita_sea_freight.csv     해상만 (~10,200행)
│   ├── kita_air_freight.csv     항공만 (~3,200행)
│   └── kita_collection_summary.xlsx  수집 현황 (앱에서 미사용)
│
├── src/
│   ├── types/
│   │   └── freight.ts           TypeScript 타입 정의
│   │
│   ├── lib/
│   │   ├── parseCsv.ts          서버 전용: CSV 파일 읽기 및 파싱
│   │   └── filterRecords.ts     공용: 데이터 필터·정렬 순수 함수
│   │
│   ├── app/
│   │   ├── layout.tsx           루트 레이아웃 (헤더/푸터)
│   │   ├── page.tsx             메인 페이지 (Server Component)
│   │   ├── globals.css          Tailwind v4 전역 CSS
│   │   │
│   │   ├── query/
│   │   │   └── page.tsx         조회 페이지 진입점
│   │   │
│   │   └── api/
│   │       └── freight/
│   │           ├── route.ts         GET /api/freight   (필터+페이지네이션)
│   │           ├── meta/
│   │           │   └── route.ts     GET /api/freight/meta  (권역·도시 목록)
│   │           └── chart/
│   │               └── route.ts     GET /api/freight/chart (차트용 시계열)
│   │
│   └── components/
│       ├── QueryInterface.tsx   조회 UI 전체 상태 관리 (Client Component)
│       ├── SearchForm.tsx       필터 폼 컴포넌트 (Client Component)
│       ├── FreightTable.tsx     결과 테이블 + 페이지네이션 (Client Component)
│       └── FreightChart.tsx     Recharts 운임 추이 차트 (Client Component)
│
├── tmp/                         FareExtract 참조용 사본 (앱 동작과 무관)
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── eslint.config.mjs
└── package.json
```

---

## 4. CSV 데이터 구조 상세

### 파일 헤더 형식

`kita_all_freight.csv` 실제 파일 앞부분:
```
# [해상] 출처: 한국무역협회(KITA) | 시장 평균 해상운임(Ocean Freight), 부산발 | ...
# [항공] 출처: 한국무역협회(KITA) | 시장 평균 항공운임(Air Freight), 부산발 | ...
분류,출발(도시),도착(국가),도착(도시),년,월,TEU,FEU,단위(USD-해상),100kg,300kg,500kg,단위(USD-항공),업데이트 일자
해상,Busan,북미,Norfolk,2026,05,3300.0,4200.0,USD,,,,,2026-05-24
항공,Incheon,북미,Chicago,2026,05,,,,11236.7,11236.7,11236.7,USD,2026-05-24
```

### 파싱 시 주의사항

1. **UTF-8 BOM**: 파일이 `utf-8-sig`로 저장됨 → 첫 문자 `﻿` 제거 필요
2. **# 주석 줄**: 첫 1~2줄이 `#`으로 시작하는 메타데이터 → papaparse 전달 전 필터링
3. **빈 값**: 해상 행은 100kg/300kg/500kg이 빈 문자열, 항공 행은 TEU/FEU가 빈 문자열
4. **월 포맷**: 한 자리 월 (예: `5`)도 존재 → `padStart(2, '0')` 처리 필요

### 컬럼 정의

| 컬럼명 | 타입 | 해상 | 항공 |
|---|---|---|---|
| 분류 | `'해상' \| '항공'` | ✅ | ✅ |
| 출발(도시) | string | `Busan` | `Incheon` |
| 도착(국가) | string | 권역명 (북미, 유럽 등) | 동일 |
| 도착(도시) | string | 목적지 도시 | 동일 |
| 년 | string | `2026` | `2026` |
| 월 | string | `05` 또는 `5` | 동일 |
| TEU | string | 20ft 컨테이너 USD | 빈 값 |
| FEU | string | 40ft 컨테이너 USD | 빈 값 |
| 단위(USD-해상) | string | `USD` | 빈 값 |
| 100kg | string | 빈 값 | 항공 100kg 기준 USD |
| 300kg | string | 빈 값 | 항공 300kg 기준 USD |
| 500kg | string | 빈 값 | 항공 500kg 기준 USD |
| 단위(USD-항공) | string | 빈 값 | `USD` |
| 업데이트 일자 | string | `2026-05-24` | 동일 |

### 권역 코드

**해상 (10개):** 러시아/CIS, 북미, 아시아, 아프리카, 오세아니아, 유럽, 일본, 중국, 중남미, 중동  
**항공 (10개):** 러시아, 북미, 아시아, 아프리카, 오세아니아, 유럽, 일본, 중국, 중남미, 중동  
→ 해상은 `러시아/CIS`, 항공은 `러시아`로 명칭이 다름

---

## 5. 개발 환경 설정

### 사전 요구사항

- Node.js 20+
- npm 10+
- Windows / macOS / Linux

### 프로젝트 생성 명령

```bash
npx create-next-app@16.2.6 farequery \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir   # 단, 이후 src/ 구조로 수동 이동
```

> **참고:** `create-next-app` 실행 시 `--src-dir` 옵션으로 src 디렉터리 사용 가능.  
> 프로젝트는 `src/app/`, `src/components/`, `src/lib/`, `src/types/` 구조를 사용함.

### 패키지 추가 설치

```bash
npm install papaparse recharts
npm install --save-dev @types/papaparse
```

> `xlsx`는 create-next-app이 자동 설치하지 않음. 필요 시: `npm install xlsx`

### tsconfig.json path alias 확인

`@/` 경로 별칭이 `src/`를 가리키도록 설정 확인:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## 6. 파일별 구현 상세

### 6-1. `src/types/freight.ts`

```typescript
export type FreightType = '해상' | '항공';

export interface FreightRecord {
  '분류': FreightType;
  '출발(도시)': string;
  '도착(국가)': string;
  '도착(도시)': string;
  '년': string;
  '월': string;
  'TEU': string;
  'FEU': string;
  '단위(USD-해상)': string;
  '100kg': string;
  '300kg': string;
  '500kg': string;
  '단위(USD-항공)': string;
  '업데이트 일자': string;
}

export interface FreightMeta {
  regions: {
    sea: string[];
    air: string[];
  };
  cities: Record<string, string[]>;
  years: string[];
  latestYearMonth: { year: string; month: string };
}

export interface FreightFilter {
  type: FreightType | 'all';
  region: string;
  city: string;
  fromYear: string;
  fromMonth: string;
  toYear: string;
  toMonth: string;
}

export interface PagedResult {
  data: FreightRecord[];
  total: number;
  page: number;
  totalPages: number;
}
```

**설계 결정:**
- 컬럼명에 한글과 특수문자(`(`, `)`, `-`) 포함 → TypeScript 인터페이스에서 따옴표로 감싸서 정의
- 모든 값을 `string`으로 유지 (CSV 원본값 보존, 컴포넌트에서 필요 시 `Number()` 변환)

---

### 6-2. `src/lib/parseCsv.ts` (서버 전용)

```typescript
import Papa from 'papaparse';
import path from 'path';
import fs from 'fs';
import type { FreightRecord, FreightMeta } from '@/types/freight';

const CSV_PATH = path.join(process.cwd(), 'FareDB', 'kita_all_freight.csv');

export function getAllRecords(): FreightRecord[] {
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const content = raw
    .replace(/^﻿/, '')                              // UTF-8 BOM 제거
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))  // 주석 줄 제거
    .join('\n');

  const result = Papa.parse<FreightRecord>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  return result.data.filter(
    (r) => r['분류'] === '해상' || r['분류'] === '항공',
  );
}

export function getMeta(records: FreightRecord[]): FreightMeta {
  const seaRecords = records.filter((r) => r['분류'] === '해상');
  const airRecords = records.filter((r) => r['분류'] === '항공');

  const seaRegions = [...new Set(seaRecords.map((r) => r['도착(국가)']))]
    .filter(Boolean).sort();
  const airRegions = [...new Set(airRecords.map((r) => r['도착(국가)']))]
    .filter(Boolean).sort();

  const cities: Record<string, string[]> = {};
  for (const r of records) {
    const region = r['도착(국가)'];
    const city = r['도착(도시)'];
    if (!region || !city) continue;
    if (!cities[region]) cities[region] = [];
    if (!cities[region].includes(city)) cities[region].push(city);
  }
  Object.values(cities).forEach((arr) => arr.sort());

  const years = [...new Set(records.map((r) => r['년']).filter(Boolean))].sort();

  const sorted = [...records]
    .filter((r) => r['년'] && r['월'])
    .sort((a, b) => {
      const ay = parseInt(a['년']) * 100 + parseInt(a['월']);
      const by = parseInt(b['년']) * 100 + parseInt(b['월']);
      return by - ay;  // 내림차순 → 첫 번째가 최신
    });

  const latestYearMonth = sorted[0]
    ? { year: sorted[0]['년'], month: sorted[0]['월'].padStart(2, '0') }
    : { year: '2026', month: '05' };

  return { regions: { sea: seaRegions, air: airRegions }, cities, years, latestYearMonth };
}
```

**핵심 주의사항:**
- `fs` 모듈 사용 → **서버 컴포넌트 및 Route Handler 전용**. Client Component에서 import 금지
- `process.cwd()`는 Next.js에서 프로젝트 루트를 가리킴 (Vercel 배포 시에도 동일)
- BOM 제거 패턴: `raw.replace(/^﻿/, '')` — 정규식 안에 실제 BOM 문자(`﻿`) 포함
- 도시 목록은 권역(region)을 키로 하는 Record 구조로 관리 → 연쇄 드롭다운 지원

---

### 6-3. `src/lib/filterRecords.ts` (공용)

```typescript
import type { FreightRecord, FreightFilter } from '@/types/freight';

export function filterRecords(
  records: FreightRecord[],
  filter: Partial<FreightFilter>,
): FreightRecord[] {
  return records.filter((r) => {
    if (filter.type && filter.type !== 'all' && r['분류'] !== filter.type) return false;
    if (filter.region && r['도착(국가)'] !== filter.region) return false;
    if (filter.city && r['도착(도시)'] !== filter.city) return false;

    const ym = `${r['년']}${r['월'].padStart(2, '0')}`;
    if (filter.fromYear) {
      const fromYm = `${filter.fromYear}${(filter.fromMonth || '01').padStart(2, '0')}`;
      if (ym < fromYm) return false;
    }
    if (filter.toYear) {
      const toYm = `${filter.toYear}${(filter.toMonth || '12').padStart(2, '0')}`;
      if (ym > toYm) return false;
    }
    return true;
  });
}

export function sortByYearMonth(records: FreightRecord[]): FreightRecord[] {
  return [...records].sort((a, b) => {
    const ay = parseInt(a['년']) * 100 + parseInt(a['월']);
    const by = parseInt(b['년']) * 100 + parseInt(b['월']);
    return by - ay;  // 최신순
  });
}
```

**설계 결정:**
- `Partial<FreightFilter>` 사용 → 서버(API)와 클라이언트(Server Component) 양쪽에서 재사용
- 기간 비교: 년+월을 `YYYYMM` 형태 문자열로 결합 후 사전순 비교 (숫자와 동일 결과)
- 원본 배열 불변성 유지: `sortByYearMonth`는 `[...records]` 복사 후 정렬

---

### 6-4. API Route: `src/app/api/freight/route.ts`

```typescript
import type { NextRequest } from 'next/server';
import { getAllRecords } from '@/lib/parseCsv';
import { filterRecords, sortByYearMonth } from '@/lib/filterRecords';
import type { FreightFilter } from '@/types/freight';

export const dynamic = 'force-dynamic';   // ← 필수: 파일시스템 읽기 → 정적 캐시 방지

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const filter: Partial<FreightFilter> = {
    type: (sp.get('type') as FreightFilter['type']) || 'all',
    region: sp.get('region') || '',
    city:   sp.get('city')   || '',
    fromYear:  sp.get('fromYear')  || '',
    fromMonth: sp.get('fromMonth') || '',
    toYear:    sp.get('toYear')    || '',
    toMonth:   sp.get('toMonth')   || '',
  };

  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));

  const all      = getAllRecords();
  const filtered = sortByYearMonth(filterRecords(all, filter));
  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const data       = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return Response.json({ data, total, page, totalPages });
}
```

**Query Parameters:**

| 파라미터 | 기본값 | 설명 |
|---|---|---|
| `type` | `all` | `sea`/`air`/`all` |
| `region` | `""` | 도착 권역 (예: `북미`) |
| `city` | `""` | 도착 도시 (예: `New York`) |
| `fromYear` | `""` | 시작 연도 |
| `fromMonth` | `""` | 시작 월 (01-12) |
| `toYear` | `""` | 종료 연도 |
| `toMonth` | `""` | 종료 월 |
| `page` | `1` | 페이지 번호 |

**Response:**
```json
{
  "data": [FreightRecord, ...],
  "total": 13458,
  "page": 1,
  "totalPages": 270
}
```

---

### 6-5. API Route: `src/app/api/freight/meta/route.ts`

```typescript
import { getAllRecords, getMeta } from '@/lib/parseCsv';

export const dynamic = 'force-dynamic';

export async function GET() {
  const records = getAllRecords();
  const meta = getMeta(records);
  return Response.json(meta);
}
```

**Response:**
```json
{
  "regions": {
    "sea": ["러시아/CIS", "북미", "아시아", ...],
    "air": ["러시아", "북미", "아시아", ...]
  },
  "cities": {
    "북미": ["Atlanta", "Chicago", "Dallas", ...],
    "유럽": ["Amsterdam", "Antwerp", ...]
  },
  "years": ["2015", "2016", ..., "2026"],
  "latestYearMonth": { "year": "2026", "month": "05" }
}
```

---

### 6-6. API Route: `src/app/api/freight/chart/route.ts`

```typescript
import type { NextRequest } from 'next/server';
import { getAllRecords } from '@/lib/parseCsv';
import { filterRecords } from '@/lib/filterRecords';
import type { FreightFilter } from '@/types/freight';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const filter: Partial<FreightFilter> = {
    type:   (sp.get('type') as FreightFilter['type']) || 'all',
    region: sp.get('region') || '',
    city:   sp.get('city')   || '',
    fromYear:  sp.get('fromYear')  || '',
    fromMonth: sp.get('fromMonth') || '',
    toYear:    sp.get('toYear')    || '',
    toMonth:   sp.get('toMonth')   || '',
  };

  const all = getAllRecords();
  const filtered = filterRecords(all, filter).sort((a, b) => {
    const ay = parseInt(a['년']) * 100 + parseInt(a['월']);
    const by = parseInt(b['년']) * 100 + parseInt(b['월']);
    return ay - by;  // 오름차순 (차트용)
  });

  return Response.json(filtered);
}
```

**메인 `/api/freight`와의 차이:**
- 페이지네이션 없음 → 모든 매칭 레코드 반환
- 정렬 방향이 오름차순(과거→현재) → Recharts X축 순서 맞춤

---

### 6-7. `src/app/globals.css`

```css
@import "tailwindcss";

:root {
  --background: #f9fafb;
  --foreground: #111827;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist), system-ui, sans-serif;
}

body {
  background: var(--background);
  color: var(--foreground);
}
```

**Tailwind v4 핵심 변경사항:**
- `tailwind.config.js` 없음
- `@import "tailwindcss"` 한 줄로 전체 Tailwind 임포트
- 커스텀 값은 `@theme` 블록 안에서 CSS 변수로 정의
- 일반 유틸리티 클래스(`flex`, `text-sm`, `bg-white` 등)는 v3과 동일하게 사용

---

### 6-8. `src/app/layout.tsx`

```typescript
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const geist = Geist({ variable: '--font-geist', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TradeFare | 무역 운임 조회',
  description: '한국무역협회(KITA) 해상·항공 참고운임 조회 시스템',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50 font-sans">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="font-bold text-blue-700 text-lg tracking-tight">
              TradeFare
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium">
              <Link href="/" className="text-gray-500 hover:text-gray-900 transition-colors">개요</Link>
              <Link href="/query" className="text-gray-500 hover:text-gray-900 transition-colors">운임 조회</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-100 bg-white py-4 text-center text-xs text-gray-400">
          출처: 한국무역협회(KITA) | 시장 참고운임으로 이용 선사·항공사·물동량에 따라 실제 운임과 상이할 수 있음
        </footer>
      </body>
    </html>
  );
}
```

---

### 6-9. `src/app/page.tsx` (Server Component — 메인 페이지)

**역할:** 최신 월의 해상·항공 운임을 권역별로 요약 표시.  
**데이터 접근:** Server Component에서 직접 `fs`를 통해 CSV 읽기.

**구조:**
```
Home() [async Server Component]
├── StatBadge 컴포넌트 (인라인 정의)
└── RateTable 컴포넌트 (인라인 정의)
    ├── 권역별 1개 대표 도시의 최신 운임 표시
    └── 해상: TEU/FEU, 항공: 100kg
```

**핵심 로직:**
```typescript
const records = getAllRecords();
const meta = getMeta(records);
const { year, month } = meta.latestYearMonth;

// 최신 월 데이터만 필터링
const latestSea = filterRecords(records, { type: '해상', fromYear: year, fromMonth: month, toYear: year, toMonth: month });
const latestAir = filterRecords(records, { type: '항공', fromYear: year, fromMonth: month, toYear: year, toMonth: month });

// 권역별 첫 번째 도시 데이터 추출
const seaByRegion = groupByRegion(latestSea);  // { '북미': [records...], '유럽': [records...], ... }
```

---

### 6-10. `src/app/query/page.tsx`

```typescript
import QueryInterface from '@/components/QueryInterface';

export default function QueryPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">운임 조회</h1>
        <p className="text-sm text-gray-500 mt-1">
          분류·권역·도시·기간으로 필터링하여 운임 이력을 조회합니다.
        </p>
      </div>
      <QueryInterface />
    </div>
  );
}
```

**설계 결정:** 이 파일은 서버 컴포넌트 래퍼. 실제 인터랙션은 모두 `QueryInterface` (클라이언트)가 담당.  
→ 서버에서 데이터를 pre-fetch하지 않음. 클라이언트가 마운트 후 API 호출.

---

### 6-11. `src/components/QueryInterface.tsx` (핵심 상태 관리)

**역할:** 전체 조회 UI의 상태 관리 허브.

```
QueryInterface ('use client')
├── state: meta, filter, result, chartRecords, page, loading
├── effect: 마운트 시 /api/freight/meta 1회 페치
├── effect: filter 또는 page 변경 시 /api/freight + /api/freight/chart 페치
├── SearchForm (props: meta, filter, onChange, onReset)
├── FreightTable (props: result, loading, onPageChange)
└── FreightChart (props: records, city, region) ← filter.city 있을 때만 렌더
```

**데이터 흐름:**
```
사용자 필터 변경
    → handleFilterChange(next) → setPage(1), setFilter(next)
    → useEffect 트리거
    → fetchTable(filter, 1)  → /api/freight?...
    → fetchChart(filter)     → /api/freight/chart?... (city 있을 때만)
```

**URL 파라미터 빌더:**
```typescript
function buildParams(f: FreightFilter, page: number): string {
  const p = new URLSearchParams();
  if (f.type !== 'all') p.set('type', f.type);
  if (f.region) p.set('region', f.region);
  if (f.city)   p.set('city',   f.city);
  // ... 기간 파라미터
  p.set('page', String(page));
  return p.toString();
}
```

> `type === 'all'`일 때는 파라미터 자체를 생략해 서버 기본값 활용

---

### 6-12. `src/components/SearchForm.tsx` (필터 폼)

**연쇄 드롭다운 로직:**
```typescript
// 분류에 따라 표시할 권역 목록 결정
const availableRegions =
  filter.type === '해상' ? meta.regions.sea
  : filter.type === '항공' ? meta.regions.air
  : [...new Set([...meta.regions.sea, ...meta.regions.air])].sort();

// 권역 선택 시 해당 권역 도시 목록
const availableCities = filter.region ? (meta.cities[filter.region] ?? []) : [];
```

**연쇄 초기화 로직:**
```typescript
function set<K extends keyof FreightFilter>(key: K, value: FreightFilter[K]) {
  const next = { ...filter, [key]: value };
  if (key === 'type')   { next.region = ''; next.city = ''; }  // 분류 변경 시 권역+도시 초기화
  if (key === 'region') { next.city = ''; }                    // 권역 변경 시 도시 초기화
  onChange(next);
}
```

**YearMonthSelect 내부 컴포넌트:**
- 년도 선택 → 해당 년 이후 월만 선택 가능
- `disabled={!year}` → 년도 미선택 시 월 드롭다운 비활성화

---

### 6-13. `src/components/FreightTable.tsx` (결과 테이블)

**테이블 컬럼 구성 (10열):**

| 열 | 내용 | 해상 색상 | 항공 색상 |
|---|---|---|---|
| 분류 | 해상/항공 뱃지 | 파란 뱃지 | 초록 뱃지 |
| 출발 | Busan/Incheon | gray | gray |
| 도착 권역 | 권역명 | - | - |
| 도착 도시 | 도시명 (bold) | - | - |
| 년/월 | YYYY.MM | - | - |
| TEU | 해상 전용 | blue-700 | gray-300 (흐림) |
| FEU | 해상 전용 | blue-700 | gray-300 (흐림) |
| 100kg | 항공 전용 | gray-300 (흐림) | emerald-700 |
| 300kg | 항공 전용 | gray-300 (흐림) | emerald-700 |
| 500kg | 항공 전용 | gray-300 (흐림) | emerald-700 |

> 해당 분류에 없는 값은 `—`를 표시하고 흐린 색으로 시각적 구분

**페이지네이션 알고리즘:**
```typescript
function buildPageNumbers(current, total): (number | '…')[] {
  if (total <= 7) return [1, 2, ..., total];
  // 항상 첫 페이지, 마지막 페이지 표시
  // 현재 페이지 ±1 범위 표시
  // 사이 간격에 … 삽입
}
```

---

### 6-14. `src/components/FreightChart.tsx` (Recharts 추이 차트)

**조건부 렌더링:** `QueryInterface`에서 `filter.city`가 설정된 경우에만 표시.

**차트 데이터 변환:**
```typescript
function buildChartData(records: FreightRecord[]): ChartRow[] {
  const map = new Map<string, ChartRow>();
  for (const r of records) {
    const ym = `${r['년']}.${r['월'].padStart(2, '0')}`;  // "2024.01"
    // 해상/항공 각각 해당 필드만 채움
    // 같은 ym에 해상+항공 모두 있는 경우 병합
  }
  return Array.from(map.values()).sort((a, b) => a.ym.localeCompare(b.ym));
}
```

**라인 정의:**
```typescript
const SEA_LINES = [
  { key: 'TEU',  color: '#2563EB', dash: undefined, label: 'TEU (USD)' },
  { key: 'FEU',  color: '#60A5FA', dash: '5 5',     label: 'FEU (USD)' },
];
const AIR_LINES = [
  { key: '100kg', color: '#059669', dash: undefined, label: '100kg (USD)' },
  { key: '300kg', color: '#34D399', dash: '5 5',     label: '300kg (USD)' },
  { key: '500kg', color: '#6EE7B7', dash: '3 3',     label: '500kg (USD)' },
];
```

**⚠️ Recharts TypeScript 함정:**
```typescript
// 잘못된 코드 (TypeScript 오류 발생)
<Tooltip formatter={(value: number, name: string) => [`$${value}`, name]} />

// 올바른 코드
<Tooltip formatter={(value, name) => [
  value != null ? `$${Number(value).toLocaleString()}` : '—',
  name,
]} />
```

---

## 7. 렌더링 전략

| 파일 | 전략 | 이유 |
|---|---|---|
| `app/page.tsx` | Server Component (정적) | 서버에서 CSV 읽기, 빌드 시 렌더링 가능 |
| `app/query/page.tsx` | Server Component (정적) | 단순 래퍼, 데이터 없음 |
| `app/api/freight/route.ts` | Dynamic (force-dynamic) | 파일시스템 읽기, 요청 시 실행 |
| `components/QueryInterface.tsx` | Client Component | useState, useEffect, fetch 필요 |
| `components/SearchForm.tsx` | Client Component | onChange 핸들러 |
| `components/FreightTable.tsx` | Client Component | 페이지네이션 상태 |
| `components/FreightChart.tsx` | Client Component | Recharts DOM 의존 |

---

## 8. 개발 서버 실행 및 빌드

```bash
# 개발 서버
npm run dev      → http://localhost:3000

# 프로덕션 빌드 검증
npm run build

# 프로덕션 서버 실행
npm run start

# Lint
npm run lint
```

**빌드 정상 출력:**
```
Route (app)
┌ ○ /                      정적 (서버 사이드 렌더링)
├ ○ /query                 정적
├ ƒ /api/freight           동적
├ ƒ /api/freight/chart     동적
└ ƒ /api/freight/meta      동적
```

---

## 9. 배포 (Vercel)

### 사전 조건

1. FareDB 디렉터리가 `.gitignore`에 없어야 함
2. `tmp/` 디렉터리는 앱 동작과 무관 → `.gitignore`에 추가 권장

### .gitignore 추가 항목

```
tmp/
```

### Vercel 주의사항

- `process.cwd()`는 Vercel에서도 프로젝트 루트를 가리킴 → `FareDB/` 파일 접근 정상 작동
- `export const dynamic = 'force-dynamic'` 없으면 Route Handler가 정적으로 캐시됨 → 데이터 갱신 안 됨
- FreeDB CSV 파일 총 약 2MB → Vercel 무료 티어 한도 내
- 환경변수 불필요 (모든 설정이 코드 내장)

### 배포 단계

```bash
# 1. GitHub 레포지토리 생성 및 push
gh repo create farequery --public --source=. --remote=origin --push

# 2. Vercel CLI 배포
npx vercel --prod

# 또는 vercel.com에서 GitHub 레포 연결 → 자동 배포
```

---

## 10. 향후 개선 가능 항목

| 기능 | 설명 |
|---|---|
| FareDB 자동 갱신 | FareExtract 스크래퍼 실행 후 GitHub Actions로 FareDB CSV 자동 커밋 |
| 데이터 캐싱 | `unstable_cache` 또는 모듈 레벨 캐시로 API 응답속도 개선 |
| 엑셀 내보내기 | `xlsx` 패키지 활용해 조회 결과 다운로드 기능 |
| 운임 비교 | 전월 대비 변동율(%) 계산 및 ▲▼ 표시 |
| 반응형 모바일 | 테이블 가로 스크롤, 필터 폼 세로 배치 |

---

## 11. AI로 이 프로젝트 재현 시 핵심 프롬프트 포인트

AI에게 이 프로젝트를 재현하도록 지시할 때 반드시 포함해야 하는 내용:

1. **"AGENTS.md를 먼저 읽어라"** → `node_modules/next/dist/docs/` 의 Next.js 16 가이드 확인 지시
2. **CSV BOM과 주석 처리** → `utf-8` 읽기 후 BOM 제거 + `#` 시작 줄 필터링
3. **`export const dynamic = 'force-dynamic'`** → API Route에 필수
4. **Recharts Tooltip formatter 타입** → `value: number` 직접 타이핑 금지
5. **한국어 컬럼명 접근** → `record['분류']` 브래킷 표기법 사용
6. **Tailwind v4** → `tailwind.config.js` 없음, `@import "tailwindcss"` 방식
7. **연쇄 드롭다운** → 분류 변경 시 region/city 초기화, 권역 변경 시 city 초기화
8. **차트 데이터 정렬** → chart API는 오름차순(과거→현재), 일반 API는 내림차순(최신→과거)
