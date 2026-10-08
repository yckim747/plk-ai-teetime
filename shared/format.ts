const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export const weekdayIndex = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
export const weekdayKo = (d: string) => WEEKDAYS[weekdayIndex(d)];

/** "2026-10-10" → "10/10(토)" */
export function formatDate(d: string): string {
  const [, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}(${weekdayKo(d)})`;
}

export function formatFee(fee: number | null): string {
  return fee == null ? "그린피 문의" : `${fee.toLocaleString("ko-KR")}원`;
}

/** 250000 → "25만원", 255000 → "25.5만원" */
export function formatManwon(won: number): string {
  return `${(won / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만원`;
}

export function addDays(d: string, n: number): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 기준일 이후 가장 가까운 주말(기준일이 일요일이면 그날만) */
export function upcomingWeekend(start: string): string[] {
  if (weekdayIndex(start) === 0) return [start];
  let sat = start;
  while (weekdayIndex(sat) !== 6) sat = addDays(sat, 1);
  return [sat, addDays(sat, 1)];
}
