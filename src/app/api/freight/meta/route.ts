import { getAllRecords, getMeta } from '@/lib/parseCsv';

export const dynamic = 'force-dynamic';

export async function GET() {
  const records = getAllRecords();
  const meta = getMeta(records);
  return Response.json(meta);
}
