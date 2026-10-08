import { useEffect, useState } from "react";
import { formatDate } from "../shared/format";
import type { CatalogInfo, QueryResponse, SearchCriteria, SearchResult } from "../shared/types";
import { api } from "./api";
import { Alternatives } from "./components/Alternatives";
import { Chat, type ChatMessage } from "./components/Chat";
import { CriteriaBar } from "./components/CriteriaBar";
import { ManualFilter } from "./components/ManualFilter";
import { RecommendCards } from "./components/RecommendCards";
import { ResultSummary } from "./components/ResultSummary";
import { TeeTimeList } from "./components/TeeTimeList";
import { speak, stopSpeaking, unlockAudio, useSpeaking } from "./speech";

const VOICE_REPLY_KEY = "plk.voiceReply";

function loadVoiceReply(): boolean {
  try {
    return localStorage.getItem(VOICE_REPLY_KEY) !== "off";
  } catch {
    return true;
  }
}

const isEmptyCriteria = (c: SearchCriteria) =>
  !c.dates.length && !c.regions.length && !c.clubs.length && !c.timeFrom && !c.timeTo && !c.preferredTime && !c.maxFee && !c.minFee;

/** 결과 영역으로 스크롤 (휴대폰에서는 채팅 아래에 있어 안 보이기 쉬움) */
function scrollToResults() {
  requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

export function App() {
  const [catalog, setCatalog] = useState<CatalogInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [resultSeq, setResultSeq] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [dataUpdatedAt, setDataUpdatedAt] = useState<string | null>(null);
  const [voiceReply, setVoiceReply] = useState(loadVoiceReply);
  const speaking = useSpeaking();
  const aiEnabled = catalog?.aiEnabled ?? false;

  useEffect(() => {
    api
      .catalog()
      .then((c) => {
        setCatalog(c);
        setDataUpdatedAt(c.updatedAt);
        if (!c.aiEnabled) setShowFilter(true);
      })
      .catch((e: Error) => push({ role: "assistant", text: `데이터를 불러오지 못했습니다: ${e.message}`, error: true }));
  }, []);

  function push(m: ChatMessage) {
    setMessages((prev) => [...prev.slice(-29), m]);
  }

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

  function playSpeech(text: string) {
    speak(text).catch((e: Error) => push({ role: "assistant", text: e.message, error: true }));
  }

  function apply(res: QueryResponse, opts: { message: boolean; speak: boolean }) {
    // "처음부터 다시" 등으로 조건이 모두 비면 결과도 비운다.
    const cleared = !res.result && isEmptyCriteria(res.criteria);
    setCriteria(cleared ? null : res.criteria);
    setDataUpdatedAt(res.dataUpdatedAt);
    if (res.result) {
      setResult(res.result);
      setResultSeq((n) => n + 1);
      scrollToResults();
    } else if (cleared) {
      setResult(null);
    }
    if (opts.message) {
      push({
        role: "assistant",
        text: res.reply,
        speech: res.speech,
        notices: res.notices,
        suggestions: res.clarification?.suggestions,
        resultTotal: res.result?.total,
        hasAlternatives: !!res.result?.alternatives.length,
      });
    }
    if (opts.speak && voiceReply && aiEnabled) playSpeech(res.speech);
  }

  async function ask(text: string, viaVoice = false) {
    unlockAudio();
    stopSpeaking();
    push({ role: "user", text, voice: viaVoice });
    setBusy(true);
    try {
      apply(await api.query(text, criteria), { message: true, speak: true });
    } catch (e) {
      push({ role: "assistant", text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function search(next: SearchCriteria, note?: string) {
    if (note) push({ role: "user", text: note });
    setBusy(true);
    try {
      apply(await api.search(next), { message: !!note, speak: false });
    } catch (e) {
      push({ role: "assistant", text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    stopSpeaking();
    setCriteria(null);
    setResult(null);
    push({ role: "assistant", text: "검색 조건을 초기화했어요. 원하시는 날짜와 지역을 새로 말씀해 주세요." });
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="logo" src="/logo-horizontal.png" alt="Pacific Links Korea" width={512} height={81} />
          <span className="brand-divider" aria-hidden />
          <div>
            <h1>AI 티타임 컨시어지</h1>
            <p>말하거나 입력하면 실시간 잔여 티타임에서 찾아 추천해 드려요</p>
          </div>
        </div>
        {catalog && (
          <div className="status">
            {aiEnabled && (
              <button className={`toggle${voiceReply ? " on" : ""}`} onClick={toggleVoiceReply} aria-pressed={voiceReply}>
                {voiceReply ? "🔊 음성 답변 켜짐" : "🔇 음성 답변 꺼짐"}
              </button>
            )}
            {speaking && (
              <button className="ghost small" onClick={stopSpeaking}>
                ■ 읽기 멈춤
              </button>
            )}
            <span className={`pill ${aiEnabled ? "ok" : "warn"}`}>{aiEnabled ? "AI 연결됨" : "AI 미설정 · 수동 검색"}</span>
            <span className="muted">
              {catalog.totalRows.toLocaleString("ko-KR")}건 · {formatDate(catalog.dateFrom)}~{formatDate(catalog.dateTo)}
              {dataUpdatedAt && ` · 갱신 ${new Date(dataUpdatedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
            </span>
          </div>
        )}
      </header>

      <main className="layout">
        <section className="panel chat-panel">
          <Chat
            messages={messages}
            busy={busy}
            aiEnabled={aiEnabled}
            onAsk={ask}
            onError={(text) => push({ role: "assistant", text, error: true })}
            onSpeak={playSpeech}
            onShowResults={scrollToResults}
          />
        </section>

        <section className="results" id="results">
          <div className="results-head">
            <CriteriaBar criteria={criteria} onChange={(c) => search(c)} disabled={busy} />
            <div className="head-actions">
              {criteria && (
                <button className="ghost" onClick={reset} disabled={busy}>
                  ↺ 조건 초기화
                </button>
              )}
              <button className="ghost" onClick={() => setShowFilter((v) => !v)}>
                {showFilter ? "필터 닫기" : "직접 고르기"}
              </button>
            </div>
          </div>
          {showFilter && catalog && <ManualFilter catalog={catalog} initial={criteria} onSearch={(c) => search(c, "필터로 검색")} disabled={busy} />}

          {result ? (
            <>
              <ResultSummary key={resultSeq} result={result} />
              <RecommendCards items={result.recommendations} total={result.total} />
              {result.alternatives.length > 0 && <Alternatives items={result.alternatives} onPick={(a) => search(a.criteria, `대안 선택: ${a.label}`)} />}
              {result.total > 0 && (
                <TeeTimeList result={result} onSort={(sort) => criteria && search({ ...criteria, sort })} disabled={busy} />
              )}
            </>
          ) : (
            <Empty catalog={catalog} />
          )}
        </section>
      </main>
    </div>
  );
}

function Empty({ catalog }: { catalog: CatalogInfo | null }) {
  return (
    <div className="panel empty">
      <h2>이렇게 물어보세요</h2>
      <ul>
        <li>🎤 버튼을 누르고 “이번 주 토요일 오전 한강이남 25만원 이하”라고 말해 보세요.</li>
        <li>“10월 15일 오후 2시쯤 써닝포인트”</li>
        <li>“다음 주말 제주도 새벽, 제일 싼 곳”</li>
        <li>결과가 나온 뒤에는 “좀 더 늦게”, “한강이북도 포함해줘”처럼 이어서 물어볼 수 있어요.</li>
        <li>“처음부터 다시”라고 하거나 ↺ 조건 초기화를 누르면 새로 찾을 수 있어요.</li>
      </ul>
      {catalog && (
        <p className="muted">
          조회 가능: {catalog.regions.map((r) => `${r.name} ${r.clubs.length}곳`).join(" · ")}
        </p>
      )}
    </div>
  );
}
