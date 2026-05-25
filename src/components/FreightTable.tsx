'use client';

import type { FreightRecord, PagedResult } from '@/types/freight';

interface Props {
  result: PagedResult | null;
  loading: boolean;
  onPageChange: (page: number) => void;
}

export default function FreightTable({ result, loading, onPageChange }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
        데이터를 불러오는 중...
      </div>
    );
  }

  if (!result) return null;

  const { data, total, page, totalPages } = result;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">
          총 <span className="text-blue-600 font-semibold">{total.toLocaleString()}</span>건
        </p>
        <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
      </div>

      {data.length === 0 ? (
        <div className="p-12 text-center text-gray-400 text-sm">조회 결과가 없습니다.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium w-14">분류</th>
                <th className="text-left px-3 py-3 font-medium">출발</th>
                <th className="text-left px-3 py-3 font-medium">도착 권역</th>
                <th className="text-left px-3 py-3 font-medium">도착 도시</th>
                <th className="text-center px-3 py-3 font-medium w-20">년/월</th>
                <th className="text-right px-3 py-3 font-medium">TEU</th>
                <th className="text-right px-3 py-3 font-medium">FEU</th>
                <th className="text-right px-3 py-3 font-medium">100kg</th>
                <th className="text-right px-3 py-3 font-medium">300kg</th>
                <th className="text-right px-5 py-3 font-medium">500kg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((r, i) => (
                <Row key={i} record={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer pagination */}
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      )}
    </div>
  );
}

function Row({ record: r }: { record: FreightRecord }) {
  const isSea = r['분류'] === '해상';
  const fmt = (v: string) => (v ? Number(v).toLocaleString() : '—');

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-2.5">
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
            isSea ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {r['분류']}
        </span>
      </td>
      <td className="px-3 py-2.5 text-gray-500">{r['출발(도시)']}</td>
      <td className="px-3 py-2.5 text-gray-700">{r['도착(국가)']}</td>
      <td className="px-3 py-2.5 text-gray-900 font-medium">{r['도착(도시)']}</td>
      <td className="px-3 py-2.5 text-center text-gray-500 tabular-nums">
        {r['년']}.{r['월'].padStart(2, '0')}
      </td>
      <td className={`px-3 py-2.5 text-right tabular-nums ${isSea ? 'text-blue-700' : 'text-gray-300'}`}>
        {fmt(r['TEU'])}
      </td>
      <td className={`px-3 py-2.5 text-right tabular-nums ${isSea ? 'text-blue-700' : 'text-gray-300'}`}>
        {fmt(r['FEU'])}
      </td>
      <td className={`px-3 py-2.5 text-right tabular-nums ${!isSea ? 'text-emerald-700' : 'text-gray-300'}`}>
        {fmt(r['100kg'])}
      </td>
      <td className={`px-3 py-2.5 text-right tabular-nums ${!isSea ? 'text-emerald-700' : 'text-gray-300'}`}>
        {fmt(r['300kg'])}
      </td>
      <td className={`px-5 py-2.5 text-right tabular-nums ${!isSea ? 'text-emerald-700' : 'text-gray-300'}`}>
        {fmt(r['500kg'])}
      </td>
    </tr>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const pages = buildPageNumbers(page, totalPages);

  return (
    <div className="flex items-center gap-1 text-sm">
      <PageBtn onClick={() => onPageChange(page - 1)} disabled={page === 1}>
        ←
      </PageBtn>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-400">…</span>
        ) : (
          <PageBtn
            key={p}
            onClick={() => onPageChange(p as number)}
            active={p === page}
          >
            {p}
          </PageBtn>
        ),
      )}
      <PageBtn onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>
        →
      </PageBtn>
    </div>
  );
}

function PageBtn({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-w-8 h-8 px-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed'
      }`}
    >
      {children}
    </button>
  );
}

function buildPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [];
  const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };
  add(1);
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) add(p);
  if (current < total - 2) pages.push('…');
  add(total);
  return pages;
}
