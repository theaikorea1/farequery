export type FreightType = '해상' | '항공';

export interface FreightRecord {
  '분류': FreightType;
  '출발(도시)': string;
  '도착(국가)': string;
  '도착(도시)': string;
  '년': string;
  '월': string;
  'TEU': string;
  'FEU': string;
  '단위(USD-해상)': string;
  '100kg': string;
  '300kg': string;
  '500kg': string;
  '단위(USD-항공)': string;
  '업데이트 일자': string;
}

export interface FreightMeta {
  regions: {
    sea: string[];
    air: string[];
  };
  cities: Record<string, string[]>;
  years: string[];
  latestYearMonth: { year: string; month: string };
}

export interface FreightFilter {
  type: FreightType | 'all';
  region: string;
  city: string;
  fromYear: string;
  fromMonth: string;
  toYear: string;
  toMonth: string;
}

export interface PagedResult {
  data: FreightRecord[];
  total: number;
  page: number;
  totalPages: number;
}
