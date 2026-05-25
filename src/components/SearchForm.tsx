'use client';

import type { FreightFilter, FreightMeta } from '@/types/freight';

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const m = String(i + 1).padStart(2, '0');
  return { value: m, label: `${i + 1}월` };
});

interface Props {
  meta: FreightMeta;
  filter: FreightFilter;
  onChange: (f: FreightFilter) => void;
  onReset: () => void;
}

export default function SearchForm({ meta, filter, onChange, onReset }: Props) {
  const availableRegions =
    filter.type === '해상'
      ? meta.regions.sea
      : filter.type === '항공'
        ? meta.regions.air
        : [...new Set([...meta.regions.sea, ...meta.regions.air])].sort();

  const availableCities = filter.region ? (meta.cities[filter.region] ?? []) : [];

  function set<K extends keyof FreightFilter>(key: K, value: FreightFilter[K]) {
    const next = { ...filter, [key]: value };
    if (key === 'type') { next.region = ''; next.city = ''; }
    if (key === 'region') { next.city = ''; }
    onChange(next);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700">운임 검색</span>
        <span className="text-xs text-gray-400">
          데이터 기준: {meta.latestYearMonth.year}년 {parseInt(meta.latestYearMonth.month)}월
        </span>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        {/* 분류 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">화물 분류</label>
          <select
            value={filter.type}
            onChange={(e) => set('type', e.target.value as FreightFilter['type'])}
            className="h-9 px-3 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체</option>
            <option value="해상">해상</option>
            <option value="항공">항공</option>
          </select>
        </div>

        {/* 권역 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">도착 권역</label>
          <select
            value={filter.region}
            onChange={(e) => set('region', e.target.value)}
            className="h-9 px-3 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 권역</option>
            {availableRegions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* 도시 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">도착 도시</label>
          <select
            value={filter.city}
            onChange={(e) => set('city', e.target.value)}
            disabled={!filter.region}
            className="h-9 px-3 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">전체 도시</option>
            {availableCities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* 기간 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">조회 기간</label>
          <div className="flex items-center gap-1">
            <YearMonthSelect
              year={filter.fromYear}
              month={filter.fromMonth}
              years={meta.years}
              onYearChange={(v) => set('fromYear', v)}
              onMonthChange={(v) => set('fromMonth', v)}
              placeholder="시작"
            />
            <span className="text-gray-400 text-sm px-1">~</span>
            <YearMonthSelect
              year={filter.toYear}
              month={filter.toMonth}
              years={meta.years}
              onYearChange={(v) => set('toYear', v)}
              onMonthChange={(v) => set('toMonth', v)}
              placeholder="종료"
            />
          </div>
        </div>

        {/* 초기화 */}
        <button
          onClick={onReset}
          className="h-9 px-4 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          초기화
        </button>
      </div>
    </div>
  );
}

function YearMonthSelect({
  year,
  month,
  years,
  onYearChange,
  onMonthChange,
  placeholder,
}: {
  year: string;
  month: string;
  years: string[];
  onYearChange: (v: string) => void;
  onMonthChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex gap-1">
      <select
        value={year}
        onChange={(e) => onYearChange(e.target.value)}
        className="h-9 px-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`${placeholder} 년도`}
      >
        <option value="">{placeholder} 년</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <select
        value={month}
        onChange={(e) => onMonthChange(e.target.value)}
        disabled={!year}
        className="h-9 px-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        aria-label={`${placeholder} 월`}
      >
        <option value="">월</option>
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
    </div>
  );
}
