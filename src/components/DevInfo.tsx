import { formatDate } from "../../shared/format";
import type { CatalogInfo, SearchCriteria } from "../../shared/types";
import { ManualFilter } from "./ManualFilter";

interface Props {
  catalog: CatalogInfo | null;
  busy: boolean;
  onSearch: (c: SearchCriteria, note: string) => void;
}

const TRY = [
  "이번 주 토요일 오전 한강이남 25만원 이하",
  "→ 좀 더 늦게 / 한강이북도 포함해줘 / 더 싼 곳 없어? / 토요일 말고 일요일로",
  "10월 24일 제주도 새벽 10만원 이하 (결과 0건 → 대안 제안)",
  "남서울CC 다음 주 토요일 (데이터에 없는 골프장)",
  "처음부터 다시",
];

/** 페이지 맨 아래: 개발·검수 담당자용 정보 (기본 접힘) */
export function DevInfo({ catalog, busy, onSearch }: Props) {
  return (
    <details className="devinfo">
      <summary>테스트 정보 (개발·검수용)</summary>
      {catalog ? (
        <div className="devinfo-body">
          <dl>
            <div>
              <dt>AI</dt>
              <dd>
                {catalog.models
                  ? `연결됨 · 해석 ${catalog.models.parse} · 음성 인식 ${catalog.models.stt} · 음성 답변 ${catalog.models.tts}`
                  : "미설정 (OPENAI_API_KEY 없음) — 자연어·음성 문의 불가, 아래 직접 검색만 가능"}
              </dd>
            </div>
            <div>
              <dt>데이터</dt>
              <dd>
                {catalog.totalRows.toLocaleString("ko-KR")}건 · {catalog.regions.reduce((n, r) => n + r.clubs.length, 0)}개 골프장 · {formatDate(catalog.dateFrom)}~{formatDate(catalog.dateTo)}
              </dd>
            </div>
            <div>
              <dt>갱신</dt>
              <dd>
                {new Date(catalog.updatedAt).toLocaleString("ko-KR")} · 기준일(오늘) {formatDate(catalog.today)}
              </dd>
            </div>
          </dl>
          <h4>테스트해 볼 문장</h4>
          <ul>
            {TRY.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <h4>직접 검색 (AI 없이)</h4>
          <ManualFilter catalog={catalog} initial={null} onSearch={(c) => onSearch(c, "필터로 검색")} disabled={busy} />
          <h4>알려진 제한</h4>
          <ul>
            <li>예약 요청은 데모 화면입니다. 실제 예약·저장은 되지 않습니다.</li>
            <li>그린피 0원 데이터는 "그린피 문의"로 표시하고, 예산 조건이 있으면 제외합니다.</li>
            <li>음성 답변은 결과보다 약 3~6초 늦게 재생됩니다. 음성 인식이 날짜(예: 십일/십이일)를 잘못 듣는 경우가 드물게 있습니다.</li>
            <li>마이크는 처음 한 번 허용하면 페이지를 닫을 때까지 유지됩니다(브라우저에 마이크 사용 표시가 남음).</li>
          </ul>
        </div>
      ) : (
        <p className="muted">불러오는 중…</p>
      )}
    </details>
  );
}
