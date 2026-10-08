import type { SearchCriteria, SearchResult } from "../shared/types";
import { formatDate, formatFee, weekdayKo } from "./dates";

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

/** "2026-10-10" → "10월 10일" (요일 없이) */
const speakMonthDay = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`;

function speakCriteria(c: SearchCriteria): string {
  let when = "전체 기간";
  const first = c.dates[0];
  const last = c.dates[c.dates.length - 1];
  // 여러 날짜는 짧게: "10월 10일과 11일", "10월 12일부터 16일 사이" (달이 바뀌면 뒷날짜도 월까지)
  const lastShort = last && first.slice(0, 7) === last.slice(0, 7) ? `${Number(last.slice(8))}일` : last && speakMonthDay(last);
  if (c.dates.length === 1) when = speakDate(first);
  else if (c.dates.length === 2) when = `${speakMonthDay(first)}과 ${lastShort}`;
  else if (c.dates.length > 2) when = `${speakMonthDay(first)}부터 ${lastShort} 사이`;
  const where = c.clubs.length ? c.clubs.map(speakClub).join(", ") : c.regions.length ? c.regions.join(", ") : "전체 지역";
  return `${when} ${where}`;
}

/**
 * 음성 답변 문장. 먼저 알아들은 조건을 되읽고(스트리밍이라 결과 화면과 거의 동시에 들린다),
 * 추천 하나만 짧게 말한 뒤 나머지는 화면으로 안내한다.
 */
export function buildSpeech(r: SearchResult): string {
  const asked = `${speakCriteria(r.criteria)}에서 찾아봤어요.`;
  if (r.total === 0) {
    return r.alternatives.length
      ? `${asked} 조건에 맞는 티타임은 없고, 조금 바꾼 대안을 화면에 보여드릴게요.`
      : `${asked} 조건에 맞는 티타임은 없어요. 날짜나 지역을 바꿔서 다시 말씀해 주세요.`;
  }
  const t = r.recommendations[0].teeTime;
  // 여러 날짜를 물었으면 추천 날짜는 요일만 ("토요일 오전 8시")
  const day = r.criteria.dates.length === 1 ? "" : `${weekdayKo(t.date)}요일 `;
  const fee = t.fee == null ? "그린피는 문의가 필요해요" : `${speakFee(t.fee)}이에요`;
  return `${asked} 티타임 ${r.total}개가 있고, 추천은 ${speakClub(t.club)} ${day}${speakTime(t.time)}, ${fee}. 나머지는 화면에서 확인해 주세요.`;
}
