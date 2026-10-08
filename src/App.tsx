import { useCallback, useEffect, useRef, useState } from "react";
import { formatDate } from "../shared/format";
import type { CatalogInfo, FeaturedSection, QueryResponse, Recommendation, SearchCriteria, SearchResult, TeeTime } from "../shared/types";
import { api } from "./api";
import { AllResultsSheet } from "./components/AllResultsSheet";
import { AssistantMessage, type AssistantMsg } from "./components/AssistantMessage";
import { Composer } from "./components/Composer";
import { DevInfo } from "./components/DevInfo";
import { FilterSheet } from "./components/FilterSheet";
import { Header } from "./components/Header";
import { Home } from "./components/Home";
import { Sheet } from "./components/Sheet";
import { TeeTimeDetail } from "./components/TeeTimeDetail";
import { MicIcon } from "./icons";
import { playAck, speak, stopSpeaking, unlockAudio } from "./speech";

interface UserMsg {
  id: number;
  role: "user";
  text: string;
  voice?: boolean;
}
type Msg = UserMsg | AssistantMsg;
type SheetState = { kind: "detail"; rec: Recommendation } | { kind: "all"; result: SearchResult } | { kind: "filter" } | null;

const VOICE_REPLY_KEY = "plk.voiceReply";
/** 맥락 이해용으로 AI에 넘기는 최근 대화 수 */
const HISTORY_TURNS = 6;
let nextId = 1;

function loadVoiceReply(): boolean {
  try {
    return localStorage.getItem(VOICE_REPLY_KEY) !== "off";
  } catch {
    return true;
  }
}

const isEmptyCriteria = (c: SearchCriteria) =>
  !c.dates.length && !c.regions.length && !c.clubs.length && !c.timeFrom && !c.timeTo && !c.preferredTime && !c.maxFee && !c.minFee;

/** "07:30" ± 분 */
function shiftTime(t: string, minutes: number): string {
  const m = Math.max(5 * 60, Math.min(20 * 60, Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + minutes));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function App() {
  const [catalog, setCatalog] = useState<CatalogInfo | null>(null);
  const [featured, setFeatured] = useState<FeaturedSection[] | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null);
  const [busy, setBusy] = useState(false);
  const [voiceReply, setVoiceReply] = useState(loadVoiceReply);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [devOpen, setDevOpen] = useState(false);
  const threadEnd = useRef<HTMLDivElement>(null);
  const aiEnabled = catalog?.aiEnabled ?? false;

  const push = useCallback((m: Omit<UserMsg, "id"> | Omit<AssistantMsg, "id">) => {
    setMessages((prev) => [...prev.slice(-39), { ...m, id: nextId++ } as Msg]);
  }, []);
  const pushError = useCallback((text: string) => push({ role: "assistant", text, error: true }), [push]);

  useEffect(() => {
    api.catalog().then(setCatalog, (e: Error) => pushError(`데이터를 불러오지 못했습니다: ${e.message}`));
    api.featured().then(setFeatured, () => setFeatured([]));
  }, [pushError]);

  // 새 답변이 오면 답변 시작 위치로, 내가 보낸 말·로딩은 대화의 끝으로 스크롤한다.
  // (페이지 맨 아래로 보내면 그 아래 테스트 정보까지 내려갔다가 다시 올라와 화면이 튄다)
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    requestAnimationFrame(() => {
      if (last.role === "assistant") document.getElementById(`m-${last.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      else threadEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [messages]);

  function toggleVoiceReply() {
    const next = !voiceReply;
    setVoiceReply(next);
    if (next) unlockAudio();
    else stopSpeaking();
    try {
      localStorage.setItem(VOICE_REPLY_KEY, next ? "on" : "off");
    } catch {
      // 저장 불가 환경은 이번 접속에서만 유지
    }
  }

  /** @param afterCurrent 즉시 응답 멘트("네, 찾아볼게요")가 끝난 뒤에 이어서 재생 */
  function playSpeech(text: string, afterCurrent = false) {
    speak(text, { afterCurrent }).catch((e: Error) => pushError(e.message));
  }

  function apply(res: QueryResponse, withSpeech: boolean) {
    // "처음부터 다시" 등으로 조건이 모두 비면 이어지는 조건도 비운다.
    setCriteria(!res.result && isEmptyCriteria(res.criteria) ? null : res.criteria);
    push({ role: "assistant", text: res.reply, speech: res.speech, notices: res.notices, suggestions: res.clarification?.suggestions, result: res.result });
    if (withSpeech && voiceReply && aiEnabled) playSpeech(res.speech, true);
  }

  async function ask(text: string, viaVoice = false) {
    unlockAudio();
    // 음성으로 물으면 바로 "네, 찾아볼게요"로 응답해 검색하는 동안 기다리는 느낌을 줄인다.
    if (viaVoice && voiceReply && aiEnabled) playAck();
    else stopSpeaking();
    setDevOpen(false);
    push({ role: "user", text, voice: viaVoice });
    setBusy(true);
    try {
      const history = messages
        .filter((m) => !(m.role === "assistant" && m.error))
        .slice(-HISTORY_TURNS)
        .map((m) => ({ role: m.role, text: m.text.slice(0, 600) }));
      apply(await api.query(text, criteria, history), true);
    } catch (e) {
      pushError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** 버튼으로 하는 검색 (조건 선택·더 보기·대안·다른 시간 등). AI는 쓰지 않지만 음성 답변은 똑같이 나온다. */
  async function search(next: SearchCriteria, note: string) {
    // 버튼을 누른 순간에 오디오를 깨워 둬야 휴대폰에서 응답 후 소리가 난다.
    unlockAudio();
    stopSpeaking();
    setSheet(null);
    setDevOpen(false);
    push({ role: "user", text: note });
    setBusy(true);
    try {
      apply(await api.search(next), true);
    } catch (e) {
      pushError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function newChat() {
    stopSpeaking();
    setSheet(null);
    setMessages([]);
    setCriteria(null);
    window.scrollTo({ top: 0 });
  }

  const moreAtClub = (t: TeeTime) =>
    search({ dates: [t.date], regions: [], clubs: [t.club], sort: "time" }, `${t.club} ${formatDate(t.date)} 다른 시간 보기`);
  const similar = (t: TeeTime) =>
    search(
      { dates: [t.date], regions: [t.region], clubs: [], timeFrom: shiftTime(t.time, -60), timeTo: shiftTime(t.time, 60), preferredTime: t.time, sort: "recommend" },
      `${formatDate(t.date)} ${t.region} ${t.time} 전후 비슷한 티타임`,
    );
  const select = (rec: Recommendation) => setSheet({ kind: "detail", rec });
  const openFilter = () => setSheet({ kind: "filter" });

  return (
    <div className="app">
      <Header voiceReply={voiceReply} showVoiceToggle={aiEnabled} canReset={messages.length > 0} onToggleVoice={toggleVoiceReply} onNewChat={newChat} />

      <main className="main">
        <div className="column">
          {messages.length === 0 ? (
            <Home featured={featured} aiEnabled={aiEnabled} onSelect={select} onMore={search} onAsk={ask} onOpenFilter={openFilter} />
          ) : (
            <div className="thread">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={m.id} className="umsg">
                    <p>
                      {m.voice && <MicIcon className="voice-mark" width={14} height={14} aria-label="음성" />}
                      {m.text}
                    </p>
                  </div>
                ) : (
                  <AssistantMessage
                    key={m.id}
                    msg={m}
                    isLast={i === messages.length - 1}
                    busy={busy}
                    canSpeak={aiEnabled}
                    canAsk={aiEnabled}
                    onSpeak={(t) => playSpeech(t)}
                    onSelect={select}
                    onShowAll={(result) => setSheet({ kind: "all", result })}
                    onSearch={search}
                    onAsk={ask}
                    onNewChat={newChat}
                    onOpenFilter={openFilter}
                  />
                ),
              )}
              {busy && (
                <div className="typing" role="status">
                  <span className="dots" aria-hidden>
                    <i />
                    <i />
                    <i />
                  </span>
                  티타임을 찾고 있어요
                </div>
              )}
              <div ref={threadEnd} className="thread-end" aria-hidden />
            </div>
          )}
          <DevInfo catalog={catalog} open={devOpen} onToggle={setDevOpen} />
        </div>
      </main>

      <Composer disabled={!aiEnabled} busy={busy} onSend={ask} onError={pushError} onOpenFilter={openFilter} />

      {sheet?.kind === "detail" && (
        <Sheet title="티타임 상세" onClose={() => setSheet(null)}>
          <TeeTimeDetail rec={sheet.rec} onMoreAtClub={moreAtClub} onSimilar={similar} onClose={() => setSheet(null)} />
        </Sheet>
      )}
      {sheet?.kind === "filter" && catalog && (
        <Sheet title="조건으로 찾기" onClose={() => setSheet(null)}>
          <FilterSheet catalog={catalog} initial={criteria} onSearch={search} />
        </Sheet>
      )}
      {sheet?.kind === "all" && (
        <Sheet title="전체 티타임" onClose={() => setSheet(null)}>
          <AllResultsSheet result={sheet.result} onSelect={select} />
        </Sheet>
      )}
    </div>
  );
}
