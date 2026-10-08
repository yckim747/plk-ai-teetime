import type { SearchCriteria, SearchResult } from "../shared/types";
import { formatDate, formatFee } from "./dates";

/**
 * 실제 검색 결과만으로 응답 문구를 만든다(모델이 결과를 지어내지 않도록).
 * 적용 조건은 화면에 칩으로 따로 보이므로 문장은 대화체로 짧게 쓴다.
 */
export function buildReply(r: SearchResult): string {
  if (r.total === 0) {
    return r.alternatives.length
      ? "조건에 맞는 티타임이 없어요. 조건을 조금 바꾸면 이런 시간이 있어요."
      : "조건에 맞는 티타임이 없어요. 날짜나 지역을 바꿔서 다시 물어봐 주세요.";
  }
  const t = r.recommendations[0].teeTime;
  const lead = r.criteria.sort === "price" ? "가격 위주로 보면 " : "";
  return (
    `${r.clubCount}개 골프장에서 티타임 ${r.total.toLocaleString("ko-KR")}개를 찾았어요. ` +
    `${lead}가장 추천하는 건 ${t.club} ${formatDate(t.date)} ${t.time} ${t.course}(${formatFee(t.fee)})예요.`
  );
}

// ---- 음성 답변용 문장 (기호·괄호 없이 소리 내어 읽기 좋은 형태) ----

const speakClub = (club: string) => club.replace(/\(.*?\)/g, "").trim();

/** "2026-10-10" → "10월 10일 토요일" (숫자 표기가 한글 표기보다 음성 합성 발음이 정확했다) */
export function speakDate(d: string): string {
  const [, m, day] = d.split("-").map(Number);
  return `${m}월 ${day}일 ${formatDate(d).slice(-2, -1)}요일`;
}

/** "08:13" → "오전 8시 13분", "13:00" → "오후 1시" */
export function speakTime(t: string): string {
  const h = Number(t.slice(0, 2));
  const m = Number(t.slice(3, 5));
  const h12 = h > 12 ? h - 12 : h;
  return `${h < 12 ? "오전" : "오후"} ${h12}시${m ? ` ${m}분` : ""}`;
}

/** 195000 → "19만 5천원", 그린피 미정 → "그린피는 문의가 필요" */
export function speakFee(fee: number | null): string {
  if (fee == null) return "그린피는 별도 문의";
  const man = Math.floor(fee / 10000);
  const cheon = Math.round((fee % 10000) / 1000);
  return `그린피 ${[man && `${man}만`, cheon && `${cheon}천`].filter(Boolean).join(" ")}원`;
}

function speakCriteria(c: SearchCriteria): string {
  let when = "전체 기간";
  if (c.dates.length === 1) when = speakDate(c.dates[0]);
  else if (c.dates.length === 2) when = `${speakDate(c.dates[0])}과 ${speakDate(c.dates[1])}`;
  else if (c.dates.length > 2) when = `${speakDate(c.dates[0])}부터 ${speakDate(c.dates[c.dates.length - 1])} 사이`;
  const where = c.clubs.length ? c.clubs.map(speakClub).join(", ") : c.regions.length ? c.regions.join(", ") : "전체 지역";
  return `${when} ${where}`;
}

export function buildSpeech(r: SearchResult): string {
  const desc = speakCriteria(r.criteria);
  if (r.total === 0) {
    return r.alternatives.length
      ? `${desc} 조건에 맞는 티타임은 없어요. 조건을 조금 바꾼 대안을 화면에 보여드릴게요.`
      : `${desc} 조건에 맞는 티타임은 없어요. 날짜나 지역을 바꿔서 다시 말씀해 주세요.`;
  }
  const t = r.recommendations[0].teeTime;
  const day = r.criteria.dates.length === 1 ? "" : `${speakDate(t.date)} `;
  return (
    `${desc} 조건으로 티타임 ${r.total}개를 찾았어요. ` +
    `가장 추천드리는 곳은 ${speakClub(t.club)}, ${day}${speakTime(t.time)}, ${speakFee(t.fee)}입니다. ` +
    `추천 티타임과 전체 목록은 화면에서 확인해 주세요.`
  );
}
