import type { SearchCriteria, SearchResult } from "../../shared/types";
import type { CatalogData, TeeTimeSource } from "../source/TeeTimeSource";
import { pickTop, rankTeeTimes, sortForList } from "./recommend";
import { findAlternatives } from "./relax";

export const MAX_ITEMS = 500;
/** 결과가 이보다 적으면 대안을 함께 찾는다 */
const FEW_RESULTS = 3;

export async function runSearch(source: TeeTimeSource, criteria: SearchCriteria, catalog: CatalogData): Promise<SearchResult> {
  const rows = await source.search(criteria);
  const ranked = rankTeeTimes(rows, criteria);
  return {
    criteria,
    total: rows.length,
    clubCount: new Set(rows.map((t) => t.club)).size,
    items: sortForList(ranked, criteria.sort).slice(0, MAX_ITEMS),
    recommendations: pickTop(ranked, 3),
    alternatives: rows.length < FEW_RESULTS ? await findAlternatives(source, criteria, catalog) : [],
  };
}
