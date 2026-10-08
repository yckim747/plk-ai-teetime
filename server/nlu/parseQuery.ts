import type OpenAI from "openai";
import { DATE_RE, SORTS, TIME_RE, type HistoryTurn, type SearchCriteria } from "../../shared/types";
import { addDays, dateRange, formatDate, weekdayIndex } from "../dates";
import type { CatalogData } from "../source/TeeTimeSource";

export interface ParseInput {
  message: string;
  prev?: SearchCriteria;
  /** 최근 대화(오래된 순). "근처", "거기" 같은 말을 해석하는 데 쓴다. */
  history?: HistoryTurn[];
  catalog: CatalogData;
  today: string;
}

export interface ParsedQuery {
  criteria: SearchCriteria;
  /** "아무 때나"처럼 날짜 무관 문의 */
  anyDate: boolean;
  needsClarification: boolean;
  question: string | null;
  suggestions: string[];
  /** 목록에 없는 골프장이 실제로 있는 곳과 가까운 지역 */
  nearRegions: string[];
}

export interface QueryParser {
  parse(input: ParseInput): Promise<ParsedQuery>;
}

/** 모델 출력 원본. strict 구조화 출력이라 모든 필드가 항상 존재한다. */
interface RawOutput {
  dates: string[];
  anyDate: boolean;
  regions: string[];
  clubs: string[];
  timeFrom: string | null;
  timeTo: string | null;
  preferredTime: string | null;
  maxFee: number | null;
  minFee: number | null;
  sort: (typeof SORTS)[number];
  needsClarification: boolean;
  question: string | null;
  suggestions: string[];
  nearRegions: string[];
}

const nullable = (type: string) => ({ type: [type, "null"] });

export function outputSchema(regions: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "dates", "anyDate", "regions", "clubs", "timeFrom", "timeTo", "preferredTime",
      "maxFee", "minFee", "sort", "needsClarification", "question", "suggestions", "nearRegions",
    ],
    properties: {
      dates: { type: "array", items: { type: "string" }, description: "YYYY-MM-DD" },
      anyDate: { type: "boolean" },
      regions: { type: "array", items: { type: "string", enum: regions } },
      clubs: { type: "array", items: { type: "string" } },
      timeFrom: { ...nullable("string"), description: "HH:mm" },
      timeTo: { ...nullable("string"), description: "HH:mm" },
      preferredTime: { ...nullable("string"), description: "HH:mm" },
      maxFee: { ...nullable("integer"), description: "원" },
      minFee: { ...nullable("integer"), description: "원" },
      sort: { type: "string", enum: [...SORTS] },
      needsClarification: { type: "boolean" },
      question: nullable("string"),
      suggestions: { type: "array", items: { type: "string" } },
      nearRegions: { type: "array", items: { type: "string", enum: regions } },
    },
  } as const;
}

/** 이번 주(월~일)부터 데이터 마지막 날이 포함된 주까지 요일이 적힌 달력 */
function calendar(today: string, dateTo: string): string {
  const monday = addDays(today, -((weekdayIndex(today) + 6) % 7));
  const end = dateTo > today ? dateTo : addDays(today, 13);
  const names = ["이번 주", "다음 주", "다다음 주"];
  const lines: string[] = [];
  for (let w = 0, start = monday; start <= end; w++, start = addDays(start, 7)) {
    const days = dateRange(start, addDays(start, 6)).map((d) => `${d}(${formatDate(d).split("(")[1]}`);
    lines.push(`- ${names[w] ?? `${w}주 후`}: ${days.join(" ")}`);
  }
  return lines.join("\n");
}

export function buildSystemPrompt(catalog: CatalogData, today: string): string {
  const clubs = [...catalog.regions].map(([r, list]) => `- ${r}: ${list.join(", ")}`).join("\n");
  return `너는 골프 티타임 상담 서비스의 '검색 조건 추출기'다. 고객 문장(음성 인식 결과일 수 있어 오타·띄어쓰기 오류가 있을 수 있음)을 읽고 검색 조건 JSON만 만든다. 티타임을 직접 추천하거나 지어내지 않는다.

오늘: ${today}(${formatDate(today).split("(")[1]}, 서울 기준
조회 가능한 데이터 기간: ${catalog.dateFrom} ~ ${catalog.dateTo}
달력(주는 월요일 시작):
${calendar(today, catalog.dateTo)}

지역(regions에는 아래 이름만 사용): ${[...catalog.regions.keys()].join(", ")}
지역 해석: 서울 남쪽·경기 남부(용인, 이천, 여주, 안성, 화성, 평택, 광주(경기), 양평, 김포, 인천)=한강이남 / 경기 북부(포천, 양주, 파주, 가평, 남양주, 의정부, 고양)=한강이북 / 강원(춘천, 홍천, 원주, 평창, 강촌, 횡성)=강원도 / 대전·세종·천안·충남·충북=충청도 / 광주광역시·전남·전북=전라도 / 부산·대구·울산·경남·경북=경상도 / 제주=제주도. "수도권"·"서울 근교"=한강이남+한강이북.

골프장 목록(지역별 정식 이름):
${clubs}

규칙:
1. clubs: 고객이 말한 골프장을 위 목록의 정식 이름으로 넣는다(예: "써닝포인트" → "써닝포인트컨트리클럽"). 목록에 없는 골프장이면 되묻지 말고 고객이 말한 이름 그대로 넣고(서버가 안내한다), 그 골프장이 실제로 있는 곳을 알면 nearRegions에 가장 가까운 지역 1~2개를 넣는다(예: 남서울CC는 성남 → 한강이남). 그 외에는 nearRegions=[]. 골프장을 말하면 regions는 비워도 된다.
2. dates: YYYY-MM-DD 목록. 달력을 보고 계산한다. "주말"=토·일, "평일"=월~금, "이번 주말"=이번 주 토·일, "다음 주 X요일"=다음 주의 X요일, "X일"만 말하면 오늘 이후 가장 가까운 X일, "내일/모레/글피"는 오늘 기준. "10월 둘째 주"처럼 기간이면 해당 날짜 모두.
3. anyDate: "아무 때나", "날짜 상관없이", "가장 빠른/제일 싼 날" 등 날짜 무관 문의면 true, dates는 [].
4. 시간: "새벽"=05:00~07:00, "오전"=05:00~12:00, "오후"=12:00~17:00, "저녁/야간/나이트"=17:00~20:00. "X시쯤/X시경/X시 정도"는 preferredTime=X시, timeFrom/timeTo는 그 앞뒤 1시간. "X시 이후/넘어서"는 timeFrom, "X시 전/까지"는 timeTo. 오전·오후 언급 없이 1~4시는 13~16시, 5~11시는 오전으로 본다. 시간 표기는 24시간 HH:mm.
5. 예산(원 단위 정수): "25만원 이하/이내/까지"=maxFee 250000, "20만원대"=minFee 200000·maxFee 299000, "30만원 이상"=minFee 300000. "싸게/저렴한/가성비"처럼 금액 없이 가격만 강조하면 금액은 넣지 말고 sort="price".
6. sort: 가격 강조="price", "제일 이른/빠른 시간 순"="time", 그 외="recommend".
7. 이전 조건이 주어지면 고객이 바꾸라고 한 부분만 바꾸고 나머지는 그대로 유지해 '전체 조건'을 출력한다.
   - "좀 더 늦게/이르게": timeFrom/timeTo를 1시간 뒤/앞으로 옮기고, preferredTime이 있었으면 그것도 1시간 옮긴다(없었으면 새로 만들지 않는다). 시간 조건이 전혀 없었다면 늦게=timeFrom 12:00, 이르게=timeTo 09:00.
   - "더 싼 곳": sort="price" (기존 예산 유지). "~도 포함/추가": 해당 항목을 기존 목록에 더한다. "~빼고": 해당 항목 제거. "가격 상관없어": 예산 제거.
   - 날짜와 장소를 새로 말하는 완전히 새 문의면 이전 조건을 버리고 새로 만든다. "처음부터/초기화"면 모두 비운다.
8. needsClarification: 티타임과 무관한 말이거나, 날짜·지역·골프장이 모두 없어 무엇을 찾을지 알 수 없을 때 true. question에 짧은 한국어 질문, suggestions에는 고객이 그대로 눌러 보낼 수 있는 구체적인 문의 2~4개를 넣되, 각 문의에 날짜와 지역이 모두 들어가야 한다(예: "이번 주말 한강이남 오전", "다음 주 토요일 제주도"). "저렴한 곳"·"티타임 예약"처럼 막연한 제안은 금지. 그 외에는 false, question=null, suggestions=[].
9. 최근 대화가 주어지면 참고해서 "근처", "거기", "그 골프장", "아까 그 날" 같은 표현이 무엇을 가리키는지 해석한다. 예: 직전에 목록에 없는 골프장을 물었고 고객이 "가까운 곳/근처 골프장"을 물으면, clubs는 비우고 그 골프장이 있는 곳의 지역을 regions에 넣고 날짜 등 나머지 조건은 이어 간다.
10. 인원·카트·캐디·홀 수 등 데이터에 없는 조건은 무시한다. 알 수 없는 값은 null 또는 빈 배열.`;
}

const valid = (re: RegExp) => (v: string | null) => (v && re.test(v) ? v : undefined);
const validTime = valid(TIME_RE);
const validFee = (v: number | null) => (v != null && Number.isInteger(v) && v > 0 ? v : undefined);

export function toParsedQuery(raw: RawOutput): ParsedQuery {
  return {
    criteria: {
      dates: raw.dates.filter((d) => DATE_RE.test(d)),
      regions: raw.regions,
      clubs: raw.clubs.map((c) => c.trim()).filter(Boolean),
      timeFrom: validTime(raw.timeFrom),
      timeTo: validTime(raw.timeTo),
      preferredTime: validTime(raw.preferredTime),
      maxFee: validFee(raw.maxFee),
      minFee: validFee(raw.minFee),
      sort: SORTS.includes(raw.sort) ? raw.sort : "recommend",
    },
    anyDate: raw.anyDate,
    needsClarification: raw.needsClarification,
    question: raw.question,
    suggestions: raw.suggestions.slice(0, 4),
    nearRegions: raw.nearRegions ?? [],
  };
}

/** OpenAI Responses API + Structured Outputs로 문장을 검색 조건으로 바꾼다. */
export class OpenAIQueryParser implements QueryParser {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async parse({ message, prev, history = [], catalog, today }: ParseInput): Promise<ParsedQuery> {
    const recent = history.length
      ? `최근 대화(오래된 순):\n${history.map((h) => `${h.role === "user" ? "고객" : "상담"}: ${h.text}`).join("\n")}\n`
      : "";
    const user = `${recent}이전 조건: ${prev ? JSON.stringify(prev) : "없음"}\n고객 문장: "${message}"`;
    const tuning = /^(gpt-5|o\d)/.test(this.model) ? { reasoning: { effort: "low" as const } } : { temperature: 0 };
    const res = await this.client.responses.create({
      model: this.model,
      store: false,
      ...tuning,
      input: [
        { role: "system", content: buildSystemPrompt(catalog, today) },
        { role: "user", content: user },
      ],
      text: {
        format: { type: "json_schema", name: "tee_time_search", strict: true, schema: outputSchema([...catalog.regions.keys()]) },
      },
    });
    return toParsedQuery(JSON.parse(res.output_text) as RawOutput);
  }
}
