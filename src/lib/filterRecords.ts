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
    return by - ay;
  });
}
