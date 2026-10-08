export { addDays, dateRange, formatDate, formatFee, formatManwon, weekdayIndex, weekdayKo } from "../shared/format";

/** 서울 기준 오늘(YYYY-MM-DD). TODAY 환경변수로 시연용 고정 가능 */
export function todaySeoul(override = process.env.TODAY): string {
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

export const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const fromMinutes = (m: number) => {
  const c = Math.max(0, Math.min(23 * 60 + 59, Math.round(m)));
  return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
};
