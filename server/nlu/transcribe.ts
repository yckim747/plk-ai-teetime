import OpenAI, { toFile } from "openai";

/** "써닝포인트컨트리클럽" → "써닝포인트" (인식 힌트용 짧은 이름) */
const shortClubName = (c: string) =>
  c.replace(/\(.*?\)/g, "").replace(/\s*(컨트리클럽|골프클럽|골프앤리조트|골프&리조트)\s*/g, " ").trim();

export interface Transcriber {
  transcribe(audio: Buffer, mimeType: string, clubs: string[]): Promise<string>;
}

const EXT: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "mp4", "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav", "audio/x-wav": "wav" };

/** OpenAI 음성 인식. 골프장 이름을 힌트로 넘겨 고유명사 인식률을 높인다. */
export class OpenAITranscriber implements Transcriber {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async transcribe(audio: Buffer, mimeType: string, clubs: string[]): Promise<string> {
    const base = mimeType.split(";")[0].trim();
    const file = await toFile(audio, `voice.${EXT[base] ?? "webm"}`, { type: base });
    const names = [...new Set(clubs.map(shortClubName))].join(", ");
    const res = await this.client.audio.transcriptions.create({
      file,
      model: this.model,
      language: "ko",
      prompt: `골프 티타임 예약 문의입니다. 날짜, 시간, 지역, 그린피, 골프장 이름이 나옵니다. 골프장: ${names}`,
    });
    return res.text.trim();
  }
}
