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
