import type { SearchCriteria, TeeTime } from "../../shared/types";

export interface CatalogData {
  /** 지역 → 골프장 목록 (데이터에 등장한 순서) */
  regions: Map<string, string[]>;
  clubRegion: Map<string, string>;
  dateFrom: string;
  dateTo: string;
  totalRows: number;
  updatedAt: Date;
}

/**
 * 티타임 데이터 소스. POC는 CsvSource를 쓰고,
 * 운영에서는 같은 인터페이스로 DB/PLK API 구현을 끼워 넣는다.
 * search는 필수 조건(날짜·지역·골프장·시간·예산)만 걸러서 돌려준다. 정렬·추천은 상위 계층 몫.
 */
export interface TeeTimeSource {
  search(criteria: SearchCriteria): Promise<TeeTime[]>;
  catalog(): Promise<CatalogData>;
}
