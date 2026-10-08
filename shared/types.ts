import { z } from "zod";

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const Time = z.string().regex(TIME_RE);
const DateStr = z.string().regex(DATE_RE);

export const SORTS = ["recommend", "price", "time"] as const;
export type Sort = (typeof SORTS)[number];

/** 검색 조건. 날짜·지역·골프장·시간·예산은 필수 필터, preferredTime은 추천 순위에만 쓴다. */
export const SearchCriteriaSchema = z.object({
  dates: z.array(DateStr).max(62).default([]),
  regions: z.array(z.string()).default([]),
  clubs: z.array(z.string()).default([]),
  timeFrom: Time.optional(),
  timeTo: Time.optional(),
  preferredTime: Time.optional(),
  maxFee: z.number().int().positive().optional(),
  minFee: z.number().int().positive().optional(),
  sort: z.enum(SORTS).default("recommend"),
});
export type SearchCriteria = z.infer<typeof SearchCriteriaSchema>;

export const emptyCriteria = (): SearchCriteria => ({ dates: [], regions: [], clubs: [], sort: "recommend" });

export interface TeeTime {
  id: string;
  date: string; // YYYY-MM-DD
  region: string;
  club: string;
  time: string; // HH:mm
  course: string;
  /** 원 단위. 0원·빈 값은 null(그린피 문의) */
  fee: number | null;
}

export interface Recommendation {
  teeTime: TeeTime;
  score: number;
  reasons: string[];
}

export interface Alternative {
  label: string;
  criteria: SearchCriteria;
  total: number;
  items: Recommendation[];
}

export interface Clarification {
  question: string;
  suggestions: string[];
}

export interface SearchResult {
  criteria: SearchCriteria;
  total: number;
  clubCount: number;
  /** 정렬된 가능 티타임 (최대 MAX_ITEMS건) */
  items: TeeTime[];
  recommendations: Recommendation[];
  alternatives: Alternative[];
}

export interface QueryResponse {
  reply: string;
  /** 음성 답변용 문장 (괄호·기호 없이 읽기 좋은 형태) */
  speech: string;
  criteria: SearchCriteria;
  clarification?: Clarification;
  result?: SearchResult;
  notices: string[];
  dataUpdatedAt: string;
}

export interface FeaturedSection {
  id: string;
  title: string;
  subtitle: string;
  /** "더 보기"를 누르면 이 조건으로 검색 */
  criteria: SearchCriteria;
  items: Recommendation[];
}

export interface ModelInfo {
  parse: string;
  stt: string;
  tts: string;
}

export interface CatalogRegion {
  name: string;
  clubs: string[];
}

export interface CatalogInfo {
  regions: CatalogRegion[];
  dateFrom: string;
  dateTo: string;
  totalRows: number;
  updatedAt: string;
  aiEnabled: boolean;
  today: string;
  /** 테스트 정보 표시용 */
  models: ModelInfo | null;
}
