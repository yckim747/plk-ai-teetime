import { useState, type FormEvent } from "react";
import { formatDate } from "../../shared/format";
import type { CatalogInfo, SearchCriteria } from "../../shared/types";

interface Props {
  catalog: CatalogInfo;
  initial: SearchCriteria | null;
  onSearch: (c: SearchCriteria) => void;
  disabled: boolean;
}

const HOURS = Array.from({ length: 16 }, (_, i) => `${String(i + 5).padStart(2, "0")}:00`);

function datesBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

/** AI 없이 조건을 직접 고르는 필터 (API 키 미설정·장애 대비) */
export function ManualFilter({ catalog, initial, onSearch, disabled }: Props) {
  const [date, setDate] = useState(initial?.dates.length === 1 ? initial.dates[0] : "");
  const [region, setRegion] = useState(initial?.regions[0] ?? "");
  const [club, setClub] = useState(initial?.clubs[0] ?? "");
  const [timeFrom, setTimeFrom] = useState(initial?.timeFrom ?? "");
  const [timeTo, setTimeTo] = useState(initial?.timeTo ?? "");
  const [maxFee, setMaxFee] = useState(initial?.maxFee ? String(initial.maxFee / 10000) : "");

  const clubs = catalog.regions.filter((r) => !region || r.name === region).flatMap((r) => r.clubs);

  function submit(e: FormEvent) {
    e.preventDefault();
    const c: SearchCriteria = {
      dates: date ? [date] : [],
      regions: region ? [region] : [],
      clubs: club ? [club] : [],
      sort: initial?.sort ?? "recommend",
    };
    if (timeFrom) c.timeFrom = timeFrom;
    if (timeTo) c.timeTo = timeTo;
    const fee = Number(maxFee);
    if (fee > 0) c.maxFee = Math.round(fee * 10000);
    onSearch(c);
  }

  return (
    <form className="filter panel" onSubmit={submit}>
      <label>
        날짜
        <select value={date} onChange={(e) => setDate(e.target.value)}>
          <option value="">전체</option>
          {datesBetween(catalog.dateFrom, catalog.dateTo).map((d) => (
            <option key={d} value={d}>
              {formatDate(d)}
            </option>
          ))}
        </select>
      </label>
      <label>
        지역
        <select
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            setClub("");
          }}
        >
          <option value="">전체</option>
          {catalog.regions.map((r) => (
            <option key={r.name}>{r.name}</option>
          ))}
        </select>
      </label>
      <label>
        골프장
        <select value={club} onChange={(e) => setClub(e.target.value)}>
          <option value="">전체</option>
          {clubs.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        시간
        <span className="row">
          <select value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} aria-label="시작 시간">
            <option value="">부터</option>
            {HOURS.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
          <select value={timeTo} onChange={(e) => setTimeTo(e.target.value)} aria-label="끝 시간">
            <option value="">까지</option>
            {HOURS.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </span>
      </label>
      <label>
        최대 그린피(만원)
        <input type="number" min={1} max={100} value={maxFee} onChange={(e) => setMaxFee(e.target.value)} placeholder="제한 없음" />
      </label>
      <button className="primary" disabled={disabled}>
        검색
      </button>
    </form>
  );
}
