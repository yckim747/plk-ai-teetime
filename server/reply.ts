import type { SearchCriteria, SearchResult } from "../shared/types";
import { formatDate, formatFee, formatManwon } from "./dates";

export function describeCriteria(c: SearchCriteria): string {
  const parts: string[] = [];
  if (c.dates.length > 4) parts.push(`${formatDate(c.dates[0])}~${formatDate(c.dates[c.dates.length - 1])} 중 ${c.dates.length}일`);
  else if (c.dates.length) parts.push(c.dates.map(formatDate).join(", "));
  else parts.push("전체 기간");
  if (c.clubs.length) parts.push(c.clubs.join(", "));
  else if (c.regions.length) parts.push(c.regions.join("·"));
  if (c.timeFrom && c.timeTo) parts.push(`${c.timeFrom}~${c.timeTo}`);
  else if (c.timeFrom) parts.push(`${c.timeFrom} 이후`);
  else if (c.timeTo) parts.push(`${c.timeTo} 이전`);
  if (c.minFee && c.maxFee) parts.push(`${formatManwon(c.minFee)}~${formatManwon(c.maxFee)}`);
  else if (c.maxFee) parts.push(`${formatManwon(c.maxFee)} 이하`);
  else if (c.minFee) parts.push(`${formatManwon(c.minFee)} 이상`);
  return parts.join(" · ");
}

/** 실제 검색 결과만으로 응답 문구를 만든다(모델이 결과를 지어내지 않도록). */
export function buildReply(r: SearchResult): string {
  const desc = describeCriteria(r.criteria);
  if (r.total === 0) {
    if (!r.alternatives.length) return `${desc} 조건에 맞는 티타임이 없습니다. 날짜나 지역을 바꿔서 다시 문의해 주세요.`;
    return `${desc} 조건에 맞는 티타임이 없습니다. 조건을 조금 바꾸면 가능한 시간이 있어요: ${r.alternatives.map((a) => a.label).join(" / ")}`;
  }
  const top = r.recommendations[0].teeTime;
  const sortNote = r.criteria.sort === "price" ? "가격 위주로 보면 " : "";
  return (
    `${desc} 조건으로 ${r.clubCount}개 골프장, ${r.total.toLocaleString("ko-KR")}개 티타임이 있습니다. ` +
    `${sortNote}가장 추천드리는 건 ${top.club} ${formatDate(top.date)} ${top.time} ${top.course}(${formatFee(top.fee)})입니다.`
  );
}
