import type { NextRequest } from 'next/server';
import { getAllRecords } from '@/lib/parseCsv';
import { filterRecords } from '@/lib/filterRecords';
import type { FreightFilter } from '@/types/freight';

export const dynamic = 'force-dynamic';

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

  const all = getAllRecords();
  const filtered = filterRecords(all, filter).sort((a, b) => {
    const ay = parseInt(a['년']) * 100 + parseInt(a['월']);
    const by = parseInt(b['년']) * 100 + parseInt(b['월']);
    return ay - by;
  });

  return Response.json(filtered);
}
