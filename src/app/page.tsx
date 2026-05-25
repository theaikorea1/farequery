import Link from 'next/link';
import { getAllRecords, getMeta } from '@/lib/parseCsv';
import { filterRecords } from '@/lib/filterRecords';

export default async function Home() {
  const records = getAllRecords();
  const meta = getMeta(records);
  const { year, month } = meta.latestYearMonth;

  const latestSea = filterRecords(records, {
    type: '해상',
    fromYear: year,
    fromMonth: month,
    toYear: year,
    toMonth: month,
  });
  const latestAir = filterRecords(records, {
    type: '항공',
    fromYear: year,
    fromMonth: month,
    toYear: year,
    toMonth: month,
  });

  const seaCityCount = new Set(records.filter((r) => r['분류'] === '해상').map((r) => r['도착(도시)'])).size;
  const airCityCount = new Set(records.filter((r) => r['분류'] === '항공').map((r) => r['도착(도시)'])).size;

  const seaByRegion = groupByRegion(latestSea);
  const airByRegion = groupByRegion(latestAir);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">
      {/* Hero */}
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2">
          한국무역협회(KITA) 참고운임
        </p>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">무역 운임 조회</h1>
        <p className="text-gray-500 mb-6 max-w-xl">
          부산·인천 출발 해상·항공 시장 참고운임 데이터를 조회합니다.
          매월 KITA가 집계한 데이터를 기반으로 합니다.
        </p>
        <div className="flex flex-wrap gap-3 mb-8">
          <StatBadge label="해상 도착도시" value={`${seaCityCount}개`} />
          <StatBadge label="항공 도착도시" value={`${airCityCount}개`} />
          <StatBadge label="데이터 시작" value={`${meta.years[0]}년`} />
          <StatBadge label="최신 데이터" value={`${year}년 ${parseInt(month)}월`} color="blue" />
        </div>
        <Link
          href="/query"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          운임 조회하기 →
        </Link>
      </div>

      {/* Latest rates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RateTable
          title={`해상운임 최신 현황`}
          subtitle={`${year}년 ${parseInt(month)}월 기준 | 부산 출발`}
          type="해상"
          byRegion={seaByRegion}
        />
        <RateTable
          title={`항공운임 최신 현황`}
          subtitle={`${year}년 ${parseInt(month)}월 기준 | 인천 출발`}
          type="항공"
          byRegion={airByRegion}
        />
      </div>
    </div>
  );
}

function groupByRegion(records: ReturnType<typeof filterRecords>) {
  const map: Record<string, typeof records> = {};
  for (const r of records) {
    const region = r['도착(국가)'];
    if (!map[region]) map[region] = [];
    map[region].push(r);
  }
  return map;
}

function StatBadge({
  label,
  value,
  color = 'gray',
}: {
  label: string;
  value: string;
  color?: 'gray' | 'blue';
}) {
  const base =
    color === 'blue'
      ? 'bg-blue-50 border-blue-200 text-blue-700'
      : 'bg-gray-50 border-gray-200 text-gray-700';
  return (
    <div className={`inline-flex flex-col px-4 py-2 rounded-lg border ${base}`}>
      <span className="text-xs opacity-70">{label}</span>
      <span className="font-semibold text-sm">{value}</span>
    </div>
  );
}

function RateTable({
  title,
  subtitle,
  type,
  byRegion,
}: {
  title: string;
  subtitle: string;
  type: '해상' | '항공';
  byRegion: Record<string, Array<{ '도착(국가)': string; '도착(도시)': string; TEU: string; FEU: string; '100kg': string }>>;
}) {
  const isSea = type === '해상';
  const regionEntries = Object.entries(byRegion).slice(0, 10);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              <th className="text-left px-5 py-3 font-medium">권역</th>
              <th className="text-left px-3 py-3 font-medium">대표 도시</th>
              {isSea ? (
                <>
                  <th className="text-right px-3 py-3 font-medium">TEU (USD)</th>
                  <th className="text-right px-5 py-3 font-medium">FEU (USD)</th>
                </>
              ) : (
                <th className="text-right px-5 py-3 font-medium">100kg (USD)</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {regionEntries.map(([region, rows]) => {
              const row = rows[0];
              return (
                <tr key={region} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-800">{region}</td>
                  <td className="px-3 py-3 text-gray-500">{row['도착(도시)']}</td>
                  {isSea ? (
                    <>
                      <td className="px-3 py-3 text-right font-mono text-blue-700">
                        {row.TEU ? Number(row.TEU).toLocaleString() : '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-blue-700">
                        {row.FEU ? Number(row.FEU).toLocaleString() : '—'}
                      </td>
                    </>
                  ) : (
                    <td className="px-5 py-3 text-right font-mono text-emerald-700">
                      {row['100kg'] ? Number(row['100kg']).toLocaleString() : '—'}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-gray-50">
        <Link
          href={`/query?type=${isSea ? '해상' : '항공'}`}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          전체 조회하기 →
        </Link>
      </div>
    </div>
  );
}
