import { useEffect, useState } from "react";
import { formatDate } from "../shared/format";
import type { CatalogInfo, QueryResponse, SearchCriteria, SearchResult } from "../shared/types";
import { api } from "./api";
import { Alternatives } from "./components/Alternatives";
import { Chat, type ChatMessage } from "./components/Chat";
import { CriteriaBar } from "./components/CriteriaBar";
import { ManualFilter } from "./components/ManualFilter";
import { RecommendCards } from "./components/RecommendCards";
import { TeeTimeList } from "./components/TeeTimeList";

export function App() {
  const [catalog, setCatalog] = useState<CatalogInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [dataUpdatedAt, setDataUpdatedAt] = useState<string | null>(null);

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

  function apply(res: QueryResponse, addMessage = true) {
    setCriteria(res.criteria);
    setDataUpdatedAt(res.dataUpdatedAt);
    if (res.result) setResult(res.result);
    if (addMessage) push({ role: "assistant", text: res.reply, notices: res.notices, suggestions: res.clarification?.suggestions });
  }

  async function ask(text: string, viaVoice = false) {
    push({ role: "user", text, voice: viaVoice });
    setBusy(true);
    try {
      apply(await api.query(text, criteria));
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
      apply(await api.search(next), !!note);
    } catch (e) {
      push({ role: "assistant", text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>⛳</span>
          <div>
            <h1>PLK AI 티타임</h1>
            <p>말하거나 입력하면 실시간 잔여 티타임에서 찾아 추천해 드려요</p>
          </div>
        </div>
        {catalog && (
          <div className="status">
            <span className={`pill ${catalog.aiEnabled ? "ok" : "warn"}`}>{catalog.aiEnabled ? "AI 연결됨" : "AI 미설정 · 수동 검색"}</span>
            <span className="muted">
              {catalog.totalRows.toLocaleString("ko-KR")}건 · {formatDate(catalog.dateFrom)}~{formatDate(catalog.dateTo)}
              {dataUpdatedAt && ` · 갱신 ${new Date(dataUpdatedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
            </span>
          </div>
        )}
      </header>

      <main className="layout">
        <section className="panel chat-panel">
          <Chat messages={messages} busy={busy} aiEnabled={catalog?.aiEnabled ?? false} onAsk={ask} onError={(text) => push({ role: "assistant", text, error: true })} />
        </section>

        <section className="results">
          <div className="results-head">
            <CriteriaBar criteria={criteria} onChange={(c) => search(c)} disabled={busy} />
            <button className="ghost" onClick={() => setShowFilter((v) => !v)}>
              {showFilter ? "필터 닫기" : "직접 고르기"}
            </button>
          </div>
          {showFilter && catalog && <ManualFilter catalog={catalog} initial={criteria} onSearch={(c) => search(c, "필터로 검색")} disabled={busy} />}

          {result ? (
            <>
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
        <li>“이번 주 토요일 오전 한강이남 25만원 이하”</li>
        <li>“10월 15일 오후 2시쯤 써닝포인트”</li>
        <li>“다음 주말 제주도 새벽, 제일 싼 곳”</li>
        <li>결과가 나온 뒤에는 “좀 더 늦게”, “한강이북도 포함해줘”처럼 이어서 물어볼 수 있어요.</li>
      </ul>
      {catalog && (
        <p className="muted">
          조회 가능: {catalog.regions.map((r) => `${r.name} ${r.clubs.length}곳`).join(" · ")}
        </p>
      )}
    </div>
  );
}
