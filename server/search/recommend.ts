import type { Recommendation, SearchCriteria, Sort, TeeTime } from "../../shared/types";
import { formatManwon, toMinutes } from "../dates";

/** 정렬 기준별 가중치(시간 적합도, 가격). "더 싼 곳"을 물으면 가격 비중이 커진다. */
const WEIGHTS: Record<Sort, { time: number; price: number }> = {
  recommend: { time: 0.55, price: 0.45 },
  price: { time: 0.25, price: 0.75 },
  time: { time: 0.75, price: 0.25 },
};

/** 희망 시간과 이만큼(분) 벌어지면 시간 점수 0 */
const TIME_ZERO_AT = 240;

export function targetMinutes(c: SearchCriteria): number | null {
  if (c.preferredTime) return toMinutes(c.preferredTime);
  if (c.timeFrom && c.timeTo) return (toMinutes(c.timeFrom) + toMinutes(c.timeTo)) / 2;
  return null;
}

const byStable = (a: TeeTime, b: TeeTime) =>
  a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.club.localeCompare(b.club) || a.id.localeCompare(b.id);

/**
 * 조건에 맞는 티타임 전체에 점수(0~100)와 추천 이유를 붙여 점수순으로 돌려준다.
 * 가격 점수는 이 결과 집합 안에서의 상대 가격이며, 그린피 미정은 가격 점수 0.
 */
export function rankTeeTimes(items: TeeTime[], c: SearchCriteria): Recommendation[] {
  const w = WEIGHTS[c.sort];
  const target = targetMinutes(c);
  const fees = items.map((t) => t.fee).filter((f): f is number => f != null);
  let minFee = Infinity;
  let maxFee = -Infinity;
  let sum = 0;
  for (const f of fees) {
    if (f < minFee) minFee = f;
    if (f > maxFee) maxFee = f;
    sum += f;
  }
  const avgFee = fees.length ? sum / fees.length : 0;

  return items
    .map((t) => {
      const reasons: string[] = [];
      let timeFit = 0.5;
      if (target != null) {
        const diff = Math.abs(toMinutes(t.time) - target);
        timeFit = Math.max(0, 1 - diff / TIME_ZERO_AT);
        if (c.preferredTime && diff <= 60) reasons.push(diff === 0 ? "희망 시간 정각" : `희망 시간과 ${Math.round(diff)}분 차이`);
      }
      let priceFit = 0;
      if (t.fee == null) {
        reasons.push("그린피 문의 필요");
      } else {
        priceFit = maxFee === minFee ? 1 : (maxFee - t.fee) / (maxFee - minFee);
        if (t.fee === minFee && maxFee !== minFee) reasons.push("조건 내 최저가");
        else if (avgFee - t.fee >= 10000) reasons.push(`평균보다 ${formatManwon(Math.round((avgFee - t.fee) / 1000) * 1000)} 저렴`);
      }
      const score = Math.round(100 * (w.time * timeFit + w.price * priceFit));
      return { teeTime: t, score, reasons };
    })
    .sort((a, b) => b.score - a.score || byStable(a.teeTime, b.teeTime));
}

/** 점수순 목록에서 상위 n개를 고르되 서로 다른 골프장을 먼저 채운다. */
export function pickTop(ranked: Recommendation[], n = 3): Recommendation[] {
  const picked: Recommendation[] = [];
  const clubs = new Set<string>();
  for (const r of ranked) {
    if (picked.length >= n) break;
    if (!clubs.has(r.teeTime.club)) {
      picked.push(r);
      clubs.add(r.teeTime.club);
    }
  }
  for (const r of ranked) {
    if (picked.length >= n) break;
    if (!picked.includes(r)) picked.push(r);
  }
  return picked;
}

/** 목록 표시 순서 */
export function sortForList(ranked: Recommendation[], sort: Sort): TeeTime[] {
  const items = ranked.map((r) => r.teeTime);
  if (sort === "recommend") return items;
  if (sort === "time") return [...items].sort(byStable);
  return [...items].sort((a, b) => (a.fee ?? Infinity) - (b.fee ?? Infinity) || byStable(a, b));
}
