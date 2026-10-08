import { formatDate } from "./format";

// ---- 음성 답변용 표현 (기호·괄호 없이 소리 내어 읽기 좋은 형태). 서버 답변과 화면(카드 안내)이 함께 쓴다. ----

/** "베어포트리조트CC(구.웅포)" → "베어포트리조트CC" */
export const speakClub = (club: string) => club.replace(/\(.*?\)/g, "").trim();

/** 음성 합성이 또렷하게 읽도록 다듬는다: "한강이남" → "한강 이남" (붙여 쓰면 "한간이남"처럼 뭉개졌다) */
export const forSpeech = (text: string) => text.replace(/한강이(남|북)/g, "한강 이$1");

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

/** 195000 → "그린피 19만 5천원", 그린피 미정 → "그린피는 별도 문의" */
export function speakFee(fee: number | null): string {
  if (fee == null) return "그린피는 별도 문의";
  const man = Math.floor(fee / 10000);
  const cheon = Math.round((fee % 10000) / 1000);
  return `그린피 ${[man && `${man}만`, cheon && `${cheon}천`].filter(Boolean).join(" ")}원`;
}

/** 카드를 눌렀을 때 읽어 주는 상세 안내 */
export function teeTimeSpeech(t: { club: string; date: string; time: string; fee: number | null }): string {
  const fee = t.fee == null ? "그린피는 문의가 필요해요" : `${speakFee(t.fee)}이에요`;
  return forSpeech(`${speakClub(t.club)}, ${speakDate(t.date)} ${speakTime(t.time)}, ${fee}. 예약하시려면 예약 요청 버튼을 눌러 주세요.`);
}
