import type { NextRequest } from 'next/server';
import { getAllRecords } from '@/lib/parseCsv';
import { filterRecords, sortByYearMonth } from '@/lib/filterRecords';
import type { FreightFilter } from '@/types/freight';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const filter: Partial<FreightFilter> = {
    type: (sp.get('type') as FreightFilter['type']) || 'all',
    region: sp.get('region') || '',
    city: sp.get('city') || '',
    fromYear: sp.get('fromYear') || '',
    fromMonth: sp.get('fromMonth') || '',
    toYear: sp.get('toYear') || '',
    toMonth: sp.get('toMonth') || '',
  };

  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));

  const all = getAllRecords();
  const filtered = sortByYearMonth(filterRecords(all, filter));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const data = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return Response.json({ data, total, page, totalPages });
}
