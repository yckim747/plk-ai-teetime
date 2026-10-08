import type { Alternative } from "../../shared/types";
import { RecommendCard } from "./RecommendCards";

interface Props {
  items: Alternative[];
  onPick: (a: Alternative) => void;
}

/** 결과가 없거나 적을 때 조건을 하나만 바꾼 대안. 고객이 골라야 조건이 바뀐다. */
export function Alternatives({ items, onPick }: Props) {
  return (
    <section className="block">
      <h2>이렇게 바꾸면 가능해요</h2>
      <div className="alts">
        {items.map((a) => (
          <div key={a.label} className="alt panel">
            <div className="alt-head">
              <strong>{a.label}</strong>
              <span className="muted">{a.total.toLocaleString("ko-KR")}건</span>
              <button className="ghost" onClick={() => onPick(a)}>
                이 조건으로 보기
              </button>
            </div>
            <div className="cards">
              {a.items.map((r) => (
                <RecommendCard key={r.teeTime.id} rec={r} compact />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
