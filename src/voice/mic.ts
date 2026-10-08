/**
 * 마이크를 한 번만 허용받고 페이지가 열려 있는 동안 재사용한다.
 * 녹음이 끝날 때마다 마이크를 완전히 닫으면 일부 브라우저(특히 iPhone Safari)가 다음 녹음 때 권한을 다시 묻는다.
 * 그래서 스트림은 유지하고, 녹음하지 않을 때는 트랙을 꺼 두어(enabled=false) 소리를 받지 않는다.
 */
let stream: MediaStream | null = null;
let pending: Promise<MediaStream> | null = null;

const isLive = (s: MediaStream) => s.getAudioTracks().some((t) => t.readyState === "live");
const setEnabled = (s: MediaStream, on: boolean) => s.getAudioTracks().forEach((t) => (t.enabled = on));

/** 녹음용 마이크 스트림. 처음 한 번만 권한을 요청한다. */
export async function acquireMic(): Promise<MediaStream> {
  if (stream && isLive(stream)) {
    setEnabled(stream, true);
    return stream;
  }
  pending ??= navigator.mediaDevices
    .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    .then((s) => {
      stream = s;
      // 장치 분리·권한 회수 등으로 끊기면 다음 녹음 때 새로 받는다.
      s.getAudioTracks().forEach((t) => t.addEventListener("ended", () => stream === s && (stream = null)));
      return s;
    })
    .finally(() => {
      pending = null;
    });
  const s = await pending;
  setEnabled(s, true);
  return s;
}

/** 녹음이 끝나면 마이크 입력을 끈다(권한과 스트림은 유지). */
export function pauseMic() {
  if (stream) setEnabled(stream, false);
}

/** 페이지를 떠날 때 마이크를 완전히 닫는다. */
export function releaseMic() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

if (typeof window !== "undefined") window.addEventListener("pagehide", releaseMic);
