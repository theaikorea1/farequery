"""
KITA 운임 월별 업데이트 스크립트
- 기존 FareDB CSV의 최신 월을 감지하여 그 이후 데이터만 수집
- 새 데이터가 없으면 종료 코드 0, "NO_NEW_DATA" 출력
- 새 데이터 추가 시 종료 코드 0, "ADDED N rows" 출력
- GitHub Actions에서 호출됨 (매월 9일, 14일 08:00 KST)
"""

import csv
import sys
import shutil
import logging
from datetime import date
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT  = SCRIPT_DIR.parent
FAREDB_DIR = REPO_ROOT / "FareDB"
ALL_CSV    = FAREDB_DIR / "kita_all_freight.csv"
SEA_CSV    = FAREDB_DIR / "kita_sea_freight.csv"
AIR_CSV    = FAREDB_DIR / "kita_air_freight.csv"
PROGRESS_DIR = SCRIPT_DIR / "progress"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


def detect_latest_ym() -> tuple[int, int]:
    """기존 CSV에서 최신 (년, 월)을 읽어 반환. 없으면 (2015, 1)."""
    if not ALL_CSV.exists():
        return 2015, 1
    latest_y, latest_m = 0, 0
    with open(ALL_CSV, encoding="utf-8-sig") as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith("#") or s.startswith("분류"):
                continue
            parts = s.split(",")
            if len(parts) < 6:
                continue
            try:
                y = int(parts[4].strip())
                m = int(parts[5].strip())
                if 2000 <= y <= 2100 and 1 <= m <= 12:
                    if (y, m) > (latest_y, latest_m):
                        latest_y, latest_m = y, m
            except (ValueError, IndexError):
                continue
    return (latest_y, latest_m) if latest_y else (2015, 1)


def load_existing_csv(path: Path) -> list[dict]:
    """CSV를 읽어 DictReader 결과 반환. 없으면 빈 리스트."""
    if not path.exists():
        return []
    rows = []
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            if line.startswith("#"):
                continue
            break
        f.seek(0)
        reader = csv.DictReader(
            (l for l in f if not l.startswith("#")),
        )
        rows = list(reader)
    return rows


def read_progress_rows() -> list[dict]:
    """progress/ 폴더의 모든 CSV에서 행을 읽어 반환."""
    if not PROGRESS_DIR.exists():
        return []
    rows = []
    for f in sorted(PROGRESS_DIR.glob("*.csv")):
        try:
            with open(f, encoding="utf-8-sig") as fp:
                reader = csv.DictReader(fp)
                rows.extend(list(reader))
        except Exception as e:
            log.warning(f"progress 파일 읽기 실패: {f.name} — {e}")
    return rows


def row_key(r: dict) -> tuple:
    return (r.get("분류",""), r.get("출발(도시)",""), r.get("도착(도시)",""),
            r.get("년",""), r.get("월",""))


def save_csv(rows: list[dict], path: Path, meta_lines: list[str]):
    COLUMNS = [
        "분류", "출발(도시)", "도착(국가)", "도착(도시)",
        "년", "월",
        "TEU", "FEU", "단위(USD-해상)",
        "100kg", "300kg", "500kg", "단위(USD-항공)",
        "업데이트 일자",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        for line in meta_lines:
            f.write(line + "\n")
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        for row in rows:
            w.writerow({col: row.get(col, "") for col in COLUMNS})
    log.info(f"저장: {path.name} ({len(rows)}행)")


def main():
    # 1. 최신 월 감지
    latest_y, latest_m = detect_latest_ym()
    today = date.today()
    log.info(f"기존 DB 최신 월: {latest_y}년 {latest_m}월")
    log.info(f"수집 목표: {latest_y}년 {latest_m}월 이후 신규 데이터")

    # 2. progress/ 초기화 (이전 실행 잔재 제거)
    if PROGRESS_DIR.exists():
        shutil.rmtree(PROGRESS_DIR)
    PROGRESS_DIR.mkdir(parents=True)

    # 3. 스크래퍼 실행 (최신 월부터 현재까지)
    log.info(f"스크래퍼 시작: {latest_y}년 {latest_m}월 ~")
    try:
        from kita_api_scraper import KitaHtmlScraper
        scraper = KitaHtmlScraper(start_year=latest_y, start_month=latest_m)
        scraper.acquire_session()
        scraper.scrape(skip_done=False)
    except Exception as e:
        log.error(f"스크래퍼 실행 실패: {e}")
        sys.exit(1)

    # 4. progress/ 에서 수집된 행 읽기
    new_rows = read_progress_rows()
    log.info(f"수집된 행 수: {len(new_rows)}")
    if not new_rows:
        log.info("수집된 데이터 없음 — KITA 미업로드 상태")
        print("NO_NEW_DATA")
        sys.exit(0)

    # 5. 기존 CSV 로드 + 중복 키 집합 생성
    existing_rows = load_existing_csv(ALL_CSV)
    existing_keys = {row_key(r) for r in existing_rows}

    # 6. 신규 행만 필터 (기존 DB에 없는 (분류+출발+도착도시+년+월) 조합)
    truly_new = [r for r in new_rows if row_key(r) not in existing_keys]
    log.info(f"신규 행 (중복 제거 후): {len(truly_new)}")

    if not truly_new:
        log.info("이미 DB에 있는 데이터만 수집됨 — 신규 없음")
        print("NO_NEW_DATA")
        sys.exit(0)

    # 7. 기존 + 신규 병합 후 CSV 저장
    META_SEA = (
        "# [해상] 출처: 한국무역협회(KITA) | "
        "시장 평균 해상운임(Ocean Freight), 부산발 | "
        "부대비용 별도 / 이용 선사·물동량·결제조건에 따라 상이 | "
        "운임 업로드: 매월 첫째 주 | 단위: USD"
    )
    META_AIR = (
        "# [항공] 출처: 한국무역협회(KITA) | "
        "시장 평균 항공운임(Air Freight), 부산발 | "
        "부대비용 별도 / 이용 항공사·물동량·결제조건에 따라 상이 | "
        "운임 업로드: 매월 첫째 주 | 단위: USD"
    )

    def ym_sort_key(r):
        try:
            return (int(r.get("년", 0)), int(r.get("월", 0)))
        except ValueError:
            return (0, 0)

    all_rows = sorted(existing_rows + truly_new, key=ym_sort_key)
    sea_rows = [r for r in all_rows if r.get("분류") == "해상"]
    air_rows = [r for r in all_rows if r.get("분류") == "항공"]

    save_csv(all_rows, ALL_CSV,  [META_SEA, META_AIR])
    save_csv(sea_rows, SEA_CSV,  [META_SEA])
    save_csv(air_rows, AIR_CSV,  [META_AIR])

    added = len(truly_new)
    log.info(f"완료: {added}행 추가 (해상 {len(sea_rows)}행 / 항공 {len(air_rows)}행 / 전체 {len(all_rows)}행)")
    print(f"ADDED {added} rows")
    sys.exit(0)


if __name__ == "__main__":
    main()
