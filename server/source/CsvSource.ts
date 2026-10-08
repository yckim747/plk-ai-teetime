import { readFile, stat } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import type { SearchCriteria, TeeTime } from "../../shared/types";
import { matches } from "../search/filter";
import type { CatalogData, TeeTimeSource } from "./TeeTimeSource";

const COLUMNS = ["날짜", "지역", "골프장", "티타임", "코스", "그린피"] as const;

interface Snapshot {
  rows: TeeTime[];
  byDate: Map<string, TeeTime[]>;
  catalog: CatalogData;
  mtimeMs: number;
}

export function normalizeDate(v: string): string | null {
  const m = v.trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

export function normalizeTime(v: string): string | null {
  const m = v.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** "270,000" → 270000, 0·빈 값·숫자 아님 → null(그린피 문의) */
export function normalizeFee(v: string): number | null {
  const n = Number(v.replace(/[,\s원]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function parseTeeTimeCsv(text: string): { rows: TeeTime[]; skipped: number } {
  const records = parse(text, { bom: true, columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  if (records.length && COLUMNS.some((c) => !(c in records[0]))) {
    throw new Error(`CSV 컬럼이 다릅니다. 필요: ${COLUMNS.join(", ")} / 실제: ${Object.keys(records[0]).join(", ")}`);
  }
  const rows: TeeTime[] = [];
  let skipped = 0;
  records.forEach((r, i) => {
    if (Object.values(r).every((v) => !v)) return; // ",,,,," 같은 빈 행
    const date = normalizeDate(r["날짜"] ?? "");
    const time = normalizeTime(r["티타임"] ?? "");
    const club = (r["골프장"] ?? "").trim();
    const region = (r["지역"] ?? "").trim();
    if (!date || !time || !club || !region) {
      skipped++;
      return;
    }
    rows.push({ id: `r${i + 2}`, date, region, club, time, course: (r["코스"] ?? "").trim(), fee: normalizeFee(r["그린피"] ?? "") });
  });
  return { rows, skipped };
}

function buildSnapshot(rows: TeeTime[], mtimeMs: number): Snapshot {
  const byDate = new Map<string, TeeTime[]>();
  const regions = new Map<string, string[]>();
  const clubRegion = new Map<string, string>();
  let dateFrom = "";
  let dateTo = "";
  for (const t of rows) {
    let list = byDate.get(t.date);
    if (!list) byDate.set(t.date, (list = []));
    list.push(t);
    if (!clubRegion.has(t.club)) {
      clubRegion.set(t.club, t.region);
      let clubs = regions.get(t.region);
      if (!clubs) regions.set(t.region, (clubs = []));
      clubs.push(t.club);
    }
    if (!dateFrom || t.date < dateFrom) dateFrom = t.date;
    if (!dateTo || t.date > dateTo) dateTo = t.date;
  }
  return {
    rows,
    byDate,
    mtimeMs,
    catalog: { regions, clubRegion, dateFrom, dateTo, totalRows: rows.length, updatedAt: new Date(mtimeMs) },
  };
}

/**
 * CSV 파일을 메모리에 올려 검색한다. 매 요청마다 파일 수정 시각을 확인해
 * 바뀌었으면 다시 읽는다(실시간 데이터 시뮬레이션). 재적재 실패 시 이전 데이터를 유지한다.
 */
export class CsvSource implements TeeTimeSource {
  private snapshot?: Snapshot;
  private loading?: Promise<Snapshot>;

  constructor(private readonly path: string) {}

  private async current(): Promise<Snapshot> {
    const { mtimeMs } = await stat(this.path);
    if (this.snapshot && this.snapshot.mtimeMs === mtimeMs) return this.snapshot;
    this.loading ??= (async () => {
      try {
        const { rows, skipped } = parseTeeTimeCsv(await readFile(this.path, "utf8"));
        this.snapshot = buildSnapshot(rows, mtimeMs);
        console.log(`[data] ${this.path} 적재: ${rows.length}행${skipped ? `, 형식 오류 ${skipped}행 제외` : ""}`);
        return this.snapshot;
      } catch (err) {
        if (!this.snapshot) throw err;
        console.error("[data] 재적재 실패, 이전 데이터 유지:", err);
        return this.snapshot;
      } finally {
        this.loading = undefined;
      }
    })();
    return this.loading;
  }

  async search(c: SearchCriteria): Promise<TeeTime[]> {
    const s = await this.current();
    const pool = c.dates.length ? c.dates.flatMap((d) => s.byDate.get(d) ?? []) : s.rows;
    return pool.filter((t) => matches(t, c));
  }

  async catalog(): Promise<CatalogData> {
    return (await this.current()).catalog;
  }
}

/** 테스트용 메모리 소스 */
export class MemorySource implements TeeTimeSource {
  private readonly snap: Snapshot;
  constructor(rows: TeeTime[]) {
    this.snap = buildSnapshot(rows, Date.UTC(2026, 9, 8));
  }
  async search(c: SearchCriteria) {
    return this.snap.rows.filter((t) => matches(t, c));
  }
  async catalog() {
    return this.snap.catalog;
  }
}
