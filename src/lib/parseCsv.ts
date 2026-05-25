import Papa from 'papaparse';
import path from 'path';
import fs from 'fs';
import type { FreightRecord, FreightMeta } from '@/types/freight';

const CSV_PATH = path.join(process.cwd(), 'FareDB', 'kita_all_freight.csv');

export function getAllRecords(): FreightRecord[] {
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const content = raw
    .replace(/^﻿/, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
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
    .filter(Boolean)
    .sort();
  const airRegions = [...new Set(airRecords.map((r) => r['도착(국가)']))]
    .filter(Boolean)
    .sort();

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
      return by - ay;
    });

  const latestYearMonth = sorted[0]
    ? { year: sorted[0]['년'], month: sorted[0]['월'].padStart(2, '0') }
    : { year: '2026', month: '05' };

  return {
    regions: { sea: seaRegions, air: airRegions },
    cities,
    years,
    latestYearMonth,
  };
}
