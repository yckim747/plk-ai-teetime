import type { FeaturedSection, Recommendation, SearchCriteria } from "../../shared/types";
import { Carousel } from "./Carousel";
import { TeeCard } from "./TeeCard";

const PROMPTS = ["이번 주말 수도권 오전", "다음 주 토요일 제주도", "20만원 이하 가성비 티타임", "10월 15일 오후 2시쯤 써닝포인트"];

interface Props {
  featured: FeaturedSection[] | null;
  aiEnabled: boolean;
  onSelect: (rec: Recommendation) => void;
  onMore: (criteria: SearchCriteria, note: string) => void;
  onAsk: (text: string) => void;
  onOpenFilter: () => void;
}

/** 첫 화면: 인사 → 바로 고를 수 있는 추천 티타임 → 물어보기 예시 */
export function Home({ featured, aiEnabled, onSelect, onMore, onAsk, onOpenFilter }: Props) {
  return (
    <section className="home">
      <div className="greet">
        <h1>어떤 티타임을 찾으세요?</h1>
        <p>
          {aiEnabled ? "아래 마이크 버튼을 누르고 말하거나 입력하면, 실시간 잔여 티타임에서 찾아드려요." : "지금은 말로 하는 문의를 쓸 수 없어요. 조건을 골라서 찾거나 아래 추천 티타임을 이용해 주세요."}
        </p>
        <button type="button" className="link greet-link" onClick={onOpenFilter}>
          {aiEnabled ? "또는 조건을 골라서 찾기 ›" : "조건을 골라서 찾기 ›"}
        </button>
      </div>

      {featured === null ? (
        <div className="feat">
          <div className="feat-head">
            <h2>추천 티타임</h2>
          </div>
          <div className="carousel">
            {[0, 1, 2].map((i) => (
              <div key={i} className="tee-card skeleton" aria-hidden />
            ))}
          </div>
        </div>
      ) : (
        featured.map((s) => (
          <section key={s.id} className="feat">
            <div className="feat-head">
              <h2>{s.title}</h2>
              <span className="muted">{s.subtitle}</span>
              <button type="button" className="link" onClick={() => onMore(s.criteria, `${s.title} 더 보기`)}>
                더 보기
              </button>
            </div>
            <Carousel label={s.title}>
              {/* 섹션마다 첫 카드(가장 점수가 높은 티타임)에 "★ 추천" */}
              {s.items.map((rec, i) => (
                <TeeCard key={rec.teeTime.id} rec={rec} showReason={false} highlight={i === 0} onSelect={onSelect} />
              ))}
            </Carousel>
          </section>
        ))
      )}

      {aiEnabled && (
        <section className="feat">
          <div className="feat-head">
            <h2>이렇게 물어보세요</h2>
          </div>
          <div className="chips">
            {PROMPTS.map((p) => (
              <button key={p} type="button" className="chip" onClick={() => onAsk(p)}>
                {p}
              </button>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
