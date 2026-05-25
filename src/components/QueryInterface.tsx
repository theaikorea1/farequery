'use client';

import { useState, useEffect, useCallback } from 'react';
import SearchForm from './SearchForm';
import FreightTable from './FreightTable';
import FreightChart from './FreightChart';
import type { FreightFilter, FreightMeta, FreightRecord, PagedResult } from '@/types/freight';

const DEFAULT_FILTER: FreightFilter = {
  type: 'all',
  region: '',
  city: '',
  fromYear: '',
  fromMonth: '',
  toYear: '',
  toMonth: '',
};

export default function QueryInterface() {
  const [meta, setMeta] = useState<FreightMeta | null>(null);
  const [filter, setFilter] = useState<FreightFilter>(DEFAULT_FILTER);
  const [result, setResult] = useState<PagedResult | null>(null);
  const [chartRecords, setChartRecords] = useState<FreightRecord[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);

  // Load meta once
  useEffect(() => {
    fetch('/api/freight/meta')
      .then((r) => r.json())
      .then((data: FreightMeta) => {
        setMeta(data);
        setMetaLoading(false);
      });
  }, []);

  const fetchTable = useCallback(
    async (f: FreightFilter, p: number) => {
      setLoading(true);
      const params = buildParams(f, p);
      const res = await fetch(`/api/freight?${params}`);
      const data: PagedResult = await res.json();
      setResult(data);
      setLoading(false);
    },
    [],
  );

  const fetchChart = useCallback(async (f: FreightFilter) => {
    if (!f.city) { setChartRecords([]); return; }
    const params = buildParams(f, 1);
    const res = await fetch(`/api/freight/chart?${params}`);
    const data: FreightRecord[] = await res.json();
    setChartRecords(data);
  }, []);

  // Fetch table whenever filter or page changes
  useEffect(() => {
    fetchTable(filter, page);
    fetchChart(filter);
  }, [filter, page, fetchTable, fetchChart]);

  function handleFilterChange(next: FreightFilter) {
    setPage(1);
    setFilter(next);
  }

  function handleReset() {
    setPage(1);
    setFilter(DEFAULT_FILTER);
  }

  if (metaLoading) {
    return (
      <div className="text-center py-20 text-sm text-gray-400">메타 데이터 로딩 중...</div>
    );
  }

  if (!meta) return null;

  return (
    <div className="space-y-4">
      <SearchForm
        meta={meta}
        filter={filter}
        onChange={handleFilterChange}
        onReset={handleReset}
      />

      <FreightTable
        result={result}
        loading={loading}
        onPageChange={(p) => setPage(p)}
      />

      {filter.city && chartRecords.length > 0 && (
        <FreightChart
          records={chartRecords}
          city={filter.city}
          region={filter.region}
        />
      )}
    </div>
  );
}

function buildParams(f: FreightFilter, page: number): string {
  const p = new URLSearchParams();
  if (f.type !== 'all') p.set('type', f.type);
  if (f.region) p.set('region', f.region);
  if (f.city) p.set('city', f.city);
  if (f.fromYear) p.set('fromYear', f.fromYear);
  if (f.fromMonth) p.set('fromMonth', f.fromMonth);
  if (f.toYear) p.set('toYear', f.toYear);
  if (f.toMonth) p.set('toMonth', f.toMonth);
  p.set('page', String(page));
  return p.toString();
}
