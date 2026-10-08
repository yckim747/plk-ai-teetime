import type { SearchResult } from "../../shared/types";

const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/** 결과 맨 위 요약. 새 결과가 오면 강조 애니메이션으로 눈에 띄게 하고, 각 영역으로 바로 이동할 수 있게 한다. */
export function ResultSummary({ result }: { result: SearchResult }) {
  if (result.total === 0) {
    return (
      <div className="summary empty-result" role="status">
        <strong>조건에 맞는 티타임이 없어요.</strong>
        {result.alternatives.length > 0 ? (
          <button className="link" onClick={() => jump("alternatives")}>
            조건을 바꾼 대안 {result.alternatives.length}가지 보기 ↓
          </button>
        ) : (
          <span>날짜나 지역을 바꿔서 다시 문의해 주세요.</span>
        )}
      </div>
    );
  }
  return (
    <div className="summary" role="status">
      <strong>
        ✅ 티타임 {result.total.toLocaleString("ko-KR")}건을 찾았어요 <span className="muted">({result.clubCount}개 골프장)</span>
      </strong>
      <span className="summary-links">
        <button className="link" onClick={() => jump("recommend")}>
          추천 {result.recommendations.length}건 ↓
        </button>
        <button className="link" onClick={() => jump("all-list")}>
          전체 목록 ↓
        </button>
      </span>
    </div>
  );
}
