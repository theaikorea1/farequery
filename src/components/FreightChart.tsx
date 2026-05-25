'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { FreightRecord } from '@/types/freight';

interface Props {
  records: FreightRecord[];
  city: string;
  region: string;
}

interface ChartRow {
  ym: string;
  TEU: number | null;
  FEU: number | null;
  '100kg': number | null;
  '300kg': number | null;
  '500kg': number | null;
}

const SEA_LINES = [
  { key: 'TEU', color: '#2563EB', dash: undefined, label: 'TEU (USD)' },
  { key: 'FEU', color: '#60A5FA', dash: '5 5', label: 'FEU (USD)' },
] as const;

const AIR_LINES = [
  { key: '100kg', color: '#059669', dash: undefined, label: '100kg (USD)' },
  { key: '300kg', color: '#34D399', dash: '5 5', label: '300kg (USD)' },
  { key: '500kg', color: '#6EE7B7', dash: '3 3', label: '500kg (USD)' },
] as const;

export default function FreightChart({ records, city, region }: Props) {
  if (records.length === 0) return null;

  const hasSea = records.some((r) => r['분류'] === '해상');
  const hasAir = records.some((r) => r['분류'] === '항공');

  const chartData = buildChartData(records);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900">
          운임 추이 — {region} / {city}
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">
          {records[0]['출발(도시)']} → {city} | {chartData[0]?.ym} ~ {chartData[chartData.length - 1]?.ym}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis
            dataKey="ym"
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickLine={false}
            axisLine={{ stroke: '#E2E8F0' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toLocaleString()}
            width={70}
          />
          <Tooltip
            formatter={(value, name) => [
              value != null ? `$${Number(value).toLocaleString()}` : '—',
              name,
            ]}
            labelFormatter={(label) => `${label}`}
            contentStyle={{
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />

          {hasSea &&
            SEA_LINES.map(({ key, color, dash, label }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={label}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={dash}
                dot={false}
                connectNulls={false}
              />
            ))}

          {hasAir &&
            AIR_LINES.map(({ key, color, dash, label }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={label}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={dash}
                dot={false}
                connectNulls={false}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function buildChartData(records: FreightRecord[]): ChartRow[] {
  const map = new Map<string, ChartRow>();

  for (const r of records) {
    const ym = `${r['년']}.${r['월'].padStart(2, '0')}`;
    if (!map.has(ym)) {
      map.set(ym, { ym, TEU: null, FEU: null, '100kg': null, '300kg': null, '500kg': null });
    }
    const row = map.get(ym)!;
    if (r['분류'] === '해상') {
      row.TEU = r['TEU'] ? parseFloat(r['TEU']) : null;
      row.FEU = r['FEU'] ? parseFloat(r['FEU']) : null;
    } else {
      row['100kg'] = r['100kg'] ? parseFloat(r['100kg']) : null;
      row['300kg'] = r['300kg'] ? parseFloat(r['300kg']) : null;
      row['500kg'] = r['500kg'] ? parseFloat(r['500kg']) : null;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.ym.localeCompare(b.ym));
}
