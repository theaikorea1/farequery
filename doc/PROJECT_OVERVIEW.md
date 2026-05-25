# TradeFare / farequery — 프로젝트 개요

## 1. 프로젝트 목적

한국무역협회(KITA)가 매월 공개하는 **해상·항공 참고운임** 데이터를 수집·저장하고,
이를 웹에서 조회할 수 있는 서비스를 제공한다.

---

## 2. 전체 아키텍처

```
[KITA 웹사이트]
    ↓  HTML POST (requests + BeautifulSoup)
[FareExtract/kita_api_scraper.py]
    ↓  CSV 출력
[FareExtract/API_output/]
    ↓  수동 복사 (또는 배포 파이프라인)
[farequery/FareDB/]        ← Next.js 앱이 읽는 데이터 소스
    ↓
[farequery (Next.js 웹앱)] ← 사용자 조회 인터페이스
```

TradeFare 프로젝트는 두 개의 서브 프로젝트로 구성된다.

| 서브 프로젝트 | 위치 | 역할 |
|---|---|---|
| **FareExtract** | `D:/Projects/TradeFare/FareExtract/` | KITA 데이터 수집 Python 스크래퍼 |
| **farequery** | `D:/Projects/TradeFare/farequery/` | 운임 조회 Next.js 웹앱 |

> `farequery/tmp/` 는 FareExtract의 핵심 파일 사본을 보관하는 참조용 디렉터리다.

---

## 3. FareExtract — 데이터 수집기

### 3-1. 기술 스택

| 항목 | 내용 |
|---|---|
| 언어 | Python 3 |
| 세션 획득 | Playwright (Chromium, headless, 최초 1회) |
| 데이터 수집 | requests + BeautifulSoup4 / HTML POST |
| 엑셀 출력 | openpyxl |
| 스케줄러 | APScheduler |

### 3-2. 수집 원리

1. Playwright로 KITA 사이트에 접속해 `JSESSIONID_KITA` 세션 쿠키 획득 (약 30초, 1회)
2. 이후 `requests.Session.post()`로 각 도시별 HTML 페이지를 직접 수신
3. `BeautifulSoup`으로 `.logistics-tb` 테이블 파싱 → 운임값 추출
4. 도시당 1~3초 (Playwright 전용 방식 대비 10배 이상 빠름)
5. 전체 수집(2015년~현재): 약 3시간

### 3-3. 수집 대상 URL

| 구분 | URL |
|---|---|
| 해상운임 | `https://kita.net/shippers/logisticsFare/logisticsSeaFare.do` |
| 항공운임 | `https://kita.net/shippers/logisticsFare/logisticsAirFare.do` |
| 해상 도시코드 API | `https://kita.net/shippers/logisticsFare/logisticsSeaCodeView.do` |
| 항공 도시코드 API | `https://kita.net/shippers/logisticsFare/logisticsAirCodeView.do` |

### 3-4. 권역 코드

**해상 (출발: Busan)**

| 코드 | 권역 |
|---|---|
| 010101 | 북미 |
| 010102 | 중남미 |
| 010103 | 유럽 |
| 010104 | 아시아 |
| 010105 | 일본 |
| 010106 | 중국 |
| 010107 | 아프리카 |
| 010108 | 오세아니아 |
| 010109 | 중동 |
| 010110 | 러시아/CIS |

**항공 (출발: Incheon)**

| 코드 | 권역 |
|---|---|
| 020101 | 북미 |
| 020102 | 중남미 |
| 020103 | 유럽 |
| 020104 | 아시아 |
| 020105 | 일본 |
| 020106 | 중국 |
| 020107 | 아프리카 |
| 020108 | 오세아니아 |
| 020109 | 중동 |
| 020110 | 러시아 |

### 3-5. 실행 방법

```bash
cd D:\Projects\TradeFare\FareExtract

# 최초 환경 설치
pip install -r requirements.txt
playwright install chromium

# 전체 수집 (2015년~현재)
python kita_api_scraper.py

# 테스트 (2025년~현재만)
python kita_api_scraper.py --from 2025

# 미수집 도시만 추가
python kita_api_scraper.py --skip-done

# 실패 도시 재수집
python kita_api_scraper.py --retry

# 매월 9일 08:00 KST 자동 스케줄
python kita_api_scraper.py --schedule

# 안전 중단
Ctrl+C
```

### 3-6. 출력 파일 구조

```
FareExtract/API_output/
├── kita_all_freight.csv              # 해상+항공 통합 최신본 (덮어쓰기)
├── kita_sea_freight.csv              # 해상 최신본
├── kita_air_freight.csv              # 항공 최신본
├── kita_all_freight_YYYYMMDD.csv     # 날짜별 백업본 (수집일 1회 생성)
├── kita_collection_summary.xlsx      # 수집 현황 Summary (5개 시트)
├── failed_cities.json                # 수집 실패 도시 목록
└── progress/
    └── {type}_{region}_{city}_{timestamp}.csv   # 도시별 중간 저장
```

**kita_collection_summary.xlsx 시트 구성**

| 시트 | 내용 |
|---|---|
| 개요(Overview) | 수집 URL·기간·행수·도시수·비표시/공백 집계 |
| 도시별이력(City_Log) | 매 수집마다 열 추가 → 최초수집/업데이트 이력 추적 |
| 운임값미배정(비표시) | 전체 누락 월(빨간) + 특정 구간 누락(주황) — KITA 미집계 |
| 운임값미배정(공백) | 행은 있으나 운임값이 공백인 경우 — KITA 미배정 |
| 전체데이터 | kita_all_freight.csv 전체 내용 |

---

## 4. FareDB — 웹앱 데이터 소스

`farequery/FareDB/` 에 위치하며 FareExtract 출력물을 복사해 관리한다.

### 4-1. 파일 목록 (2026-05-24 기준)

| 파일 | 행수 | 설명 |
|---|---|---|
| `kita_all_freight.csv` | 약 13,461행 | 해상+항공 통합 |
| `kita_sea_freight.csv` | 약 10,244행 | 해상운임만 |
| `kita_air_freight.csv` | 약 3,218행 | 항공운임만 |
| `kita_collection_summary.xlsx` | — | 수집 현황 Summary |

### 4-2. CSV 공통 스키마

```
분류, 출발(도시), 도착(국가), 도착(도시), 년, 월,
TEU, FEU, 단위(USD-해상),
100kg, 300kg, 500kg, 단위(USD-항공),
업데이트 일자
```

| 컬럼 | 타입 | 설명 |
|---|---|---|
| 분류 | string | `해상` 또는 `항공` |
| 출발(도시) | string | 해상: `Busan`, 항공: `Incheon` |
| 도착(국가) | string | 권역명 (북미, 유럽 등) |
| 도착(도시) | string | 목적지 도시명 (영문) |
| 년 | integer | 예: `2026` |
| 월 | string | 두 자리 포맷, 예: `05` |
| TEU | float | 해상 20ft 컨테이너 운임 (USD) |
| FEU | float | 해상 40ft 컨테이너 운임 (USD) |
| 단위(USD-해상) | string | `USD` (해상 행만) |
| 100kg | float | 항공 100kg 운임 (USD) |
| 300kg | float | 항공 300kg 운임 (USD) |
| 500kg | float | 항공 500kg 운임 (USD) |
| 단위(USD-항공) | string | `USD` (항공 행만) |
| 업데이트 일자 | string | `YYYY-MM-DD` |

**주의사항**
- 해상 행: TEU/FEU에 값, 항공 컬럼(100kg 등)은 빈값
- 항공 행: 100kg/300kg/500kg에 값, 해상 컬럼(TEU/FEU)은 빈값
- CSV 첫 1~2줄은 `#` 주석 메타데이터 (파싱 시 skip 필요)
- KITA 데이터 시작: 해상 2018년~, 항공 2015년~

---

## 5. farequery — 웹 조회 앱

### 5-1. 기술 스택

| 항목 | 버전/내용 |
|---|---|
| 프레임워크 | Next.js **16.2.6** (App Router) |
| UI 라이브러리 | React 19.2.4 |
| 스타일 | Tailwind CSS v4 (PostCSS 방식) |
| 언어 | TypeScript 5 |
| CSV 파싱 | papaparse ^5.5.3 |
| 엑셀 파싱 | xlsx ^0.18.5 |
| 폰트 | Geist (next/font/google) |

> **주의:** Next.js 16은 기존 버전과 API·컨벤션이 다를 수 있다.
> 코드 작성 전 `node_modules/next/dist/docs/` 가이드를 먼저 확인할 것.

### 5-2. 디렉터리 구조

```
farequery/
├── doc/                        # 프로젝트 문서
├── FareDB/                     # 운임 데이터 (CSV, xlsx)
├── public/                     # 정적 파일
├── src/
│   └── app/
│       ├── layout.tsx          # 루트 레이아웃 (Geist 폰트)
│       ├── page.tsx            # 홈 페이지 (현재 기본 템플릿)
│       └── globals.css         # Tailwind 전역 CSS
├── tmp/                        # FareExtract 참조용 파일 사본
│   ├── kita_api_scraper.py
│   ├── KITA_운임수집_통합문서_v4.docx
│   ├── README.txt
│   └── requirements.txt
├── next.config.ts
├── package.json
└── tsconfig.json
```

### 5-3. 개발 서버 실행

```bash
cd D:\Projects\TradeFare\farequery
npm run dev      # http://localhost:3000
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
```

### 5-4. 현재 구현 상태

| 기능 | 상태 |
|---|---|
| 프로젝트 스캐폴딩 | 완료 |
| FareDB 데이터 준비 | 완료 |
| UI / 조회 기능 | **미구현** |
| API 라우트 | **미구현** |
| CSV 파싱 로직 | **미구현** |

---

## 6. 데이터 갱신 주기

- KITA 운임 업로드: **매월 첫째 주**
- FareExtract 수집 스케줄: **매월 9일 08:00 KST** (`--schedule` 옵션)
- FareDB 반영: FareExtract 수집 후 수동 복사 (또는 자동화 필요)

---

## 7. 참고 문서

| 문서 | 위치 |
|---|---|
| 스크래퍼 기술 명세 | `tmp/KITA_운임수집_통합문서_v4.docx` |
| 스크래퍼 빠른 실행 가이드 | `tmp/README.txt` |
| 스크래퍼 소스 | `tmp/kita_api_scraper.py` |
